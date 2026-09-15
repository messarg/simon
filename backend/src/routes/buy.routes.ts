/** Buying, stock control and cost. PRD §15.4 (Suppliers, Buying, Stock, Reports). Online only (§14.5). */
import { Router } from "express";
import { z } from "zod";
import { AdjustmentBody, CostCorrectionBody, GoodsReceiptBody, PurchaseReturnBody, ReverseSupplierPaymentBody, SupplierBody, SupplierPaymentBody, UpdateSupplierBody, WriteOffBody } from "@simon/shared";
import { auth, requireRole } from "../middleware/auth.ts";
import { problem } from "../lib/problem.ts";
import { isAdmin, shapeMovement, stripCost } from "../lib/shape.ts";
import { correctCost, marginReport } from "../services/margin.service.ts";
import { returnToSupplier } from "../services/purchase-return.service.ts";
import { lastInvoiceCostPerStockUnit, loadReceipt, receiveGoods } from "../services/receiving.service.ts";
import { adjustStock, writeOff } from "../services/stock-adjust.service.ts";
import { paySupplier, reverseSupplierPayment } from "../services/supplier-payment.service.ts";
import { createSupplier, listSuppliers, supplierBooks, updateSupplier } from "../services/supplier.service.ts";

export function buyRoutes() {
  const r = Router();
  const stock = requireRole("STOCK");
  const admin = requireRole("ADMIN");
  const actor = (req: Express.Request) => { const a = auth(req); return { userId: a.userId, role: a.role, deviceId: a.deviceId }; };

  // Terms and balances are the owner's; STOCK sees who a supplier is, to receive against them (§16.5).
  r.get("/suppliers", stock, async (req, res) => {
    const a = auth(req);
    const { q } = z.object({ q: z.string().max(80).optional() }).parse(req.query);
    const rows = await listSuppliers(a.db, q);
    res.json({
      items: rows.filter((x) => isAdmin(a.role) || x.supplier.isActive === 1).map(({ supplier: s, books }) => (isAdmin(a.role)
        ? { id: s.id, name: s.name, phone: s.phone, taxId: s.taxId, paymentTerms: s.paymentTerms, leadTimeDays: s.leadTimeDays, isActive: s.isActive === 1, outstanding: books.outstanding, overdue: books.overdue }
        : { id: s.id, name: s.name, phone: s.phone, isActive: s.isActive === 1 })),
    });
  });
  r.post("/suppliers", stock, async (req, res) => {
    const a = auth(req);
    const s = await createSupplier(a.db, SupplierBody.parse(req.body), isAdmin(a.role));
    res.status(201).json({ id: s.id, name: s.name, phone: s.phone, isActive: s.isActive === 1 });
  });
  r.patch("/suppliers/:id", admin, async (req, res) => {
    const a = auth(req);
    const s = await updateSupplier(a.db, a.userId, String(req.params.id), UpdateSupplierBody.parse(req.body));
    res.json({ id: s.id, name: s.name, phone: s.phone, taxId: s.taxId, paymentTerms: s.paymentTerms, leadTimeDays: s.leadTimeDays, isActive: s.isActive === 1 });
  });
  r.get("/suppliers/:id/ledger", admin, async (req, res) => {
    const a = auth(req);
    const b = await supplierBooks(a.db, String(req.params.id));
    const names = new Map((await a.db.user.findMany({ select: { id: true, name: true } })).map((u) => [u.id, u.name]));
    res.json({
      supplier: { id: b.supplier.id, name: b.supplier.name, phone: b.supplier.phone, taxId: b.supplier.taxId, paymentTerms: b.supplier.paymentTerms, leadTimeDays: b.supplier.leadTimeDays, isActive: b.supplier.isActive === 1 },
      outstanding: b.outstanding, overdue: b.overdue,
      receipts: b.receipts.map((x) => ({ id: x.receipt.id, number: x.receipt.number, supplierInvoiceNo: x.receipt.supplierInvoiceNo, receivedAt: x.receipt.receivedAt, total: x.receipt.total, landedCostTotal: x.receipt.landedCostTotal, unpaid: x.unpaid, dueDate: x.dueDate, overdue: x.overdue, daysPastDue: x.daysPastDue })),
      payments: b.payments.map((p) => ({
        id: p.id, amount: p.amount, method: p.method, paidAt: p.paidAt, userName: names.get(p.userId) ?? null, reversesId: p.reversesId, reversed: b.reversedPayments.has(p.id) && !p.reversesId,
        settles: b.standing.filter((x) => x.creditType === "SUPPLIER_PAYMENT" && x.creditId === p.id).map((x) => ({ goodsReceiptId: x.goodsReceiptId, amount: x.amount })),
      })),
      returns: b.returns.map((x) => ({ id: x.id, receiptId: x.receiptId, reason: x.reason, total: x.total, landedCostLost: x.landedCostLost, createdAt: x.createdAt })),
      credits: b.credits.map((c) => ({ id: c.adjustment.id, amount: c.adjustment.amount, remaining: c.remaining, reason: c.adjustment.reason, createdAt: c.adjustment.createdAt })),
    });
  });

  // What the receiving screen needs for a product: its units and the last invoice cost per stock unit (§13.2).
  r.get("/products/:id/receiving", stock, async (req, res) => {
    const a = auth(req);
    const p = await a.db.product.findUnique({ where: { id: String(req.params.id) }, include: { units: true } });
    if (!p) throw problem("not-found");
    res.json({ productId: p.id, name: p.name, stockUom: p.stockUom, decimalPlaces: p.decimalPlaces, units: p.units.map((u) => ({ uom: u.uom, factorToStockUom: u.factorToStockUom, role: u.role })), lastInvoiceCostPerStockUnitMdram: await lastInvoiceCostPerStockUnit(a.db, p.id) });
  });

  r.post("/goods-receipts", stock, async (req, res) => {
    const a = auth(req);
    const out = await receiveGoods(a.db, actor(req), GoodsReceiptBody.parse(req.body));
    res.json(stripCost({ ...out.receipt, lines: out.lines, warnings: out.warnings }, a.role));
  });
  r.get("/goods-receipts/:id", stock, async (req, res) => {
    const a = auth(req);
    const out = await loadReceipt(a.db, String(req.params.id));
    res.json(stripCost({ ...out.receipt, lines: out.lines, warnings: out.warnings }, a.role));
  });
  r.get("/goods-receipts", stock, async (req, res) => {
    const a = auth(req);
    const q = z.object({ supplierId: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(30) }).parse(req.query);
    const rows = await a.db.goodsReceipt.findMany({ where: { supplierId: q.supplierId, reversesId: null }, orderBy: { receivedAt: "desc" }, take: q.limit, include: { supplier: { select: { name: true } } } });
    res.json({ items: rows.map((x) => ({ id: x.id, number: x.number, supplierId: x.supplierId, supplierName: x.supplier.name, supplierInvoiceNo: x.supplierInvoiceNo, receivedAt: x.receivedAt, total: x.total })) });
  });

  r.post("/purchase-returns", stock, async (req, res) => {
    const a = auth(req);
    const out = await returnToSupplier(a.db, actor(req), PurchaseReturnBody.parse(req.body));
    res.json(stripCost({ ...out.purchaseReturn, warnings: out.warnings }, a.role));
  });

  r.post("/supplier-payments", admin, async (req, res) => {
    const a = auth(req);
    res.json(await paySupplier(a.db, actor(req), SupplierPaymentBody.parse(req.body)));
  });
  r.post("/supplier-payments/:id/reverse", admin, async (req, res) => {
    const a = auth(req);
    res.json(await reverseSupplierPayment(a.db, actor(req), String(req.params.id), ReverseSupplierPaymentBody.parse(req.body)));
  });

  r.post("/write-offs", stock, async (req, res) => {
    const a = auth(req);
    res.json(shapeMovement(await writeOff(a.db, actor(req), WriteOffBody.parse(req.body)), a.role));
  });
  r.post("/adjustments", stock, async (req, res) => {
    const a = auth(req);
    res.json(shapeMovement(await adjustStock(a.db, actor(req), AdjustmentBody.parse(req.body)), a.role));
  });

  r.post("/cost-corrections", admin, async (req, res) => {
    const a = auth(req);
    res.status(201).json(await correctCost(a.db, a.userId, CostCorrectionBody.parse(req.body)));
  });
  r.get("/reports/margin", admin, async (req, res) => {
    const a = auth(req);
    const q = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.query);
    res.json(await marginReport(a.db, q.from, q.to));
  });

  return r;
}
