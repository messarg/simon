/** Selling routes: sales, returns, shifts, cash, printing, the drawer and review flags. PRD §15.3–15.4. */
import { Router } from "express";
import { z } from "zod";
import { BeginCloseBody, can, CashMovementBody, CloseShiftBody, OpenShiftBody, SaleBody, SaleReturnBody, ReviewFlagType } from "@simon/shared";
import { auth, requireAnyPermission, requirePermission } from "../middleware/auth.ts";
import { config } from "../lib/config.ts";
import { problem } from "../lib/problem.ts";
import { isManager, isOwner, seesCost, shapeFlag, shapeSale } from "../lib/shape.ts";
import { clock } from "../lib/time.ts";
import { takeBackup } from "../services/backup.service.ts";
import { issueFiscalReceipt } from "../services/fiscal.service.ts";
import { openDrawer } from "../services/drawer.service.ts";
import { printRepaymentReceipt, printReturnReceipt, printSaleReceipt, printShiftReport } from "../services/print.service.ts";
import { loadSaleReturn, returnableLines, submitSaleReturn } from "../services/sale-return.service.ts";
import { loadSale, resumeSale, saleInclude, submitSale, voidSale } from "../services/sale.service.ts";
import { beginClose, cancelClose, closeShift, currentShift, openShift, reverseCashMovement, shiftCashMovements, shiftReport, submitCashMovement } from "../services/shift.service.ts";
import { ReverseCashMovementBody } from "@simon/shared";

export function sellRoutes() {
  const r = Router();
  // The jobs of §16.4. A shift, its cash and its printouts belong to anyone who takes money at
  // the counter — for a sale or for a refund — and so does looking a sale up.
  const sell = requirePermission("sell");
  const returns = requirePermission("returns");
  const counter = requireAnyPermission("sell", "returns");
  const actor = (req: Express.Request) => { const a = auth(req); return { userId: a.userId, role: a.role, deviceId: a.deviceId, sessionId: a.sessionId }; };

  // ── Sales ──────────────────────────────────────────────────────────────────
  r.post("/sales", sell, async (req, res) => {
    const a = auth(req);
    const body = SaleBody.parse(req.body);
    // Selling on credit writes to the debt book, which is its own job (§16.4).
    if (body.payments.some((x) => x.method === "DEBT") && !can(a, "debt")) throw problem("not-permitted", { required: "debt" });
    const { sale, warnings } = await submitSale(a.db, actor(req), body);
    res.status(200).json({ ...shapeSale(sale, a.role), warnings });
    // After the response: the till's busiest request does not wait on a fiscal device (§17).
    if (sale.status === "COMPLETED" && a.mode === "LIVE") void issueFiscalReceipt(a.db, sale.id);
  });

  r.get("/sales", counter, async (req, res) => {
    const a = auth(req);
    const q = z.object({
      status: z.enum(["DRAFT", "HELD", "COMPLETED", "VOIDED"]).optional(), shiftId: z.string().optional(),
      from: z.string().optional(), to: z.string().optional(), cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(30),
    }).parse(req.query);
    const rows = await a.db.sale.findMany({
      where: {
        status: q.status, shiftId: q.shiftId,
        ...(q.from || q.to ? { businessDate: { gte: q.from, lte: q.to } } : {}),
        ...(q.cursor ? { id: { lt: q.cursor } } : {}),
      },
      include: saleInclude, orderBy: { id: "desc" }, take: q.limit + 1,
    });
    res.json({ items: rows.slice(0, q.limit).map((s) => shapeSale(s, a.role)), nextCursor: rows.length > q.limit ? rows[q.limit - 1].id : null });
  });

  r.get("/sales/by-number/:number", counter, async (req, res) => {
    const a = auth(req);
    const s = await a.db.sale.findUnique({ where: { number: String(req.params.number).toUpperCase() }, select: { id: true } });
    if (!s) throw problem("not-found");
    const { sale, warnings } = await loadSale(a.db, s.id);
    res.json({ ...shapeSale(sale, a.role), warnings });
  });

  r.get("/sales/:id", counter, async (req, res) => {
    const a = auth(req);
    const { sale, warnings } = await loadSale(a.db, String(req.params.id));
    res.json({ ...shapeSale(sale, a.role), warnings, returnable: sale.status === "COMPLETED" ? await returnableLines(a.db, sale.id) : [] });
  });

  r.post("/sales/:id/resume", sell, async (req, res) => {
    const a = auth(req);
    const { shiftId } = z.object({ shiftId: z.string().uuid() }).parse(req.body);
    const { sale, warnings } = await resumeSale(a.db, actor(req), String(req.params.id), shiftId);
    res.json({ ...shapeSale(sale, a.role), warnings });
  });

  r.post("/sales/:id/void", sell, async (req, res) => {
    const a = auth(req);
    const { sale } = await voidSale(a.db, actor(req), String(req.params.id));
    res.json(shapeSale(sale, a.role));
  });

  // ── Returns ────────────────────────────────────────────────────────────────
  r.post("/sale-returns", returns, async (req, res) => {
    const a = auth(req);
    const { saleReturn, warnings } = await submitSaleReturn(a.db, actor(req), SaleReturnBody.parse(req.body));
    res.json({ ...shapeReturn(saleReturn, a.role), warnings });
  });
  r.get("/sale-returns/:id", counter, async (req, res) => {
    const a = auth(req);
    const { saleReturn, warnings } = await loadSaleReturn(a.db, String(req.params.id));
    res.json({ ...shapeReturn(saleReturn, a.role), warnings });
  });

  // ── Shifts and cash ────────────────────────────────────────────────────────
  r.get("/shifts/current", counter, async (req, res) => {
    const a = auth(req);
    const shift = await currentShift(a.db, a.userId);
    res.json(shift ? await shiftReport(a.db, shift.id) : null);
  });
  r.post("/shifts", counter, async (req, res) => {
    const a = auth(req);
    const shift = await openShift(a.db, a.live, actor(req), OpenShiftBody.parse(req.body), { practice: a.mode === "PRACTICE" });
    res.status(201).json(await shiftReport(a.db, shift.id));
  });
  r.post("/shifts/:id/begin-close", counter, async (req, res) => {
    const a = auth(req);
    await beginClose(a.db, actor(req), String(req.params.id), BeginCloseBody.parse(req.body).unsyncedAtClose);
    res.json(await shiftReport(a.db, String(req.params.id)));
  });
  r.post("/shifts/:id/cancel-close", counter, async (req, res) => {
    const a = auth(req);
    await cancelClose(a.db, actor(req), String(req.params.id));
    res.json(await shiftReport(a.db, String(req.params.id)));
  });
  r.post("/shifts/:id/close", counter, async (req, res) => {
    const a = auth(req);
    const report = await closeShift(a.db, a.live, actor(req), String(req.params.id), CloseShiftBody.parse(req.body), { practice: a.mode === "PRACTICE" });
    // Printed here, after the close has committed: the session dies with the shift (§16.3), so the
    // till could not ask for the Z-report afterwards. A jam is reported, never a rollback (§18).
    const printed = await printShiftReport(a.db, String(req.params.id), { practice: a.mode === "PRACTICE" }).then(() => true, () => false);
    // §19.2's daily backup: the shop's day is over and this is the copy the USB drive carries.
    if (config.backup.automatic && a.mode === "LIVE") void takeBackup(a.live, "CLOSE").catch(() => undefined);
    res.json({ ...report, printed });
  });
  const reportRoute = async (req: import("express").Request, res: import("express").Response) => {
    const a = auth(req);
    const report = await shiftReport(a.db, String(req.params.id));
    if (report.shift.userId !== a.userId && !isManager(a.role)) throw problem("not-permitted");
    res.json(report);
  };
  r.get("/shifts/:id/x-report", counter, reportRoute);
  r.get("/shifts/:id/z-report", counter, reportRoute);

  r.get("/shifts/:id/cash-movements", counter, async (req, res) => {
    const a = auth(req);
    const report = await shiftReport(a.db, String(req.params.id));
    if (report.shift.userId !== a.userId && !isManager(a.role)) throw problem("not-permitted");
    res.json({ items: await shiftCashMovements(a.db, String(req.params.id)) });
  });
  r.post("/cash-movements/:id/reverse", counter, async (req, res) => {
    const a = auth(req);
    const { reason } = ReverseCashMovementBody.parse(req.body);
    const m = await reverseCashMovement(a.db, actor(req), String(req.params.id), reason);
    res.json({ id: m.id, reversesId: m.reversesId, type: m.type, amount: m.amount });
  });

  r.post("/cash-movements", counter, async (req, res) => {
    const a = auth(req);
    const m = await submitCashMovement(a.db, actor(req), CashMovementBody.parse(req.body));
    res.json({ id: m.id, shiftId: m.shiftId, type: m.type, amount: m.amount, reasonCode: m.reasonCode, reason: m.reason, businessDate: m.businessDate, createdAt: m.createdAt, warnings: [] });
  });

  // ── Printing and the drawer (host-owned, §18) ──────────────────────────────
  r.post("/print/receipt", counter, async (req, res) => {
    const a = auth(req);
    const body = z.object({ saleId: z.string().uuid().optional(), saleReturnId: z.string().uuid().optional(), debtPaymentId: z.string().uuid().optional() })
      .refine((b) => [b.saleId, b.saleReturnId, b.debtPaymentId].filter(Boolean).length === 1).parse(req.body);
    const practice = a.mode === "PRACTICE";
    // The paper carries the fiscal number, so a receipt waits for it; issuing is idempotent.
    if (body.saleId && !practice) await issueFiscalReceipt(a.db, body.saleId);
    const out = body.saleId ? await printSaleReceipt(a.db, body.saleId, { practice })
      : body.saleReturnId ? await printReturnReceipt(a.db, body.saleReturnId, { practice })
      : await printRepaymentReceipt(a.db, body.debtPaymentId!);
    res.json({ printed: out.printed });
  });
  r.post("/print/x-report", counter, async (req, res) => {
    const a = auth(req);
    const { shiftId } = z.object({ shiftId: z.string().uuid() }).parse(req.body);
    res.json({ printed: (await printShiftReport(a.db, shiftId, { practice: a.mode === "PRACTICE" })).printed });
  });
  r.post("/print/z-report", counter, async (req, res) => {
    const a = auth(req);
    const { shiftId } = z.object({ shiftId: z.string().uuid() }).parse(req.body);
    res.json({ printed: (await printShiftReport(a.db, shiftId, { practice: a.mode === "PRACTICE" })).printed });
  });
  r.post("/cash-drawer/open", counter, async (req, res) => {
    const a = auth(req);
    const body = z.object({
      document: z.object({ type: z.enum(["Sale", "SaleReturn", "CashMovement", "DebtEntry"]), id: z.string().uuid() }).nullish(),
      purpose: z.enum(["document", "float", "close", "no-sale"]).optional(),
      reauthGrant: z.string().nullish(), reason: z.string().max(240).nullish(),
    }).parse(req.body);
    // Practice never touches the drawer: the money in it is real (§19.4).
    if (a.mode === "PRACTICE") { res.json({ decision: "practice", opened: false }); return; }
    res.json(await openDrawer(a.db, actor(req), body));
  });

  // ── Review flags (§14.6, §13.6) ────────────────────────────────────────────
  r.get("/review-flags", async (req, res) => {
    const a = auth(req);
    const q = z.object({ resolved: z.enum(["true", "false"]).default("false"), type: ReviewFlagType.optional(), limit: z.coerce.number().int().min(1).max(200).default(100) }).parse(req.query);
    const rows = await a.db.reviewFlag.findMany({ where: { resolvedAt: q.resolved === "true" ? { not: null } : null, type: q.type }, orderBy: { createdAt: "desc" }, take: q.limit });
    // The list is the needs-attention screen (FR-STK-05): reading it is any session, so it names the
    // product and the document rather than an id, and a flag's note is stripped like any other payload.
    const [products, customers, sales] = await Promise.all([
      a.db.product.findMany({ where: { id: { in: rows.flatMap((f) => (f.productId ? [f.productId] : [])) } }, select: { id: true, name: true } }),
      a.db.customer.findMany({ where: { id: { in: rows.flatMap((f) => (f.customerId ? [f.customerId] : [])) } }, select: { id: true, fullName: true } }),
      a.db.sale.findMany({ where: { id: { in: rows.filter((f) => f.sourceType === "Sale").map((f) => f.sourceId) } }, select: { id: true, number: true } }),
    ]);
    const productName = new Map(products.map((p) => [p.id, p.name]));
    const customerName = new Map(customers.map((x) => [x.id, x.fullName]));
    const saleNumber = new Map(sales.map((x) => [x.id, x.number]));
    res.json({ items: rows.map((f) => shapeFlag(f, a.role, { productName: f.productId ? productName.get(f.productId) : null, customerName: f.customerId ? customerName.get(f.customerId) : null, sourceLabel: saleNumber.get(f.sourceId) ?? null })) });
  });
  r.post("/review-flags/:id/resolve", requirePermission("stocktake"), async (req, res) => {
    const a = auth(req);
    const flag = await a.db.reviewFlag.findUnique({ where: { id: String(req.params.id) } });
    if (!flag) throw problem("not-found");
    // A recount flag is cleared by whoever counts stock; a cost variance is about cost and so the
    // owner's; every other type is for whoever runs the shop (§15.4, §16.4).
    if (flag.type === "COST_VARIANCE" && !isOwner(a.role)) throw problem("not-permitted", { required: "OWNER" });
    if (flag.type !== "INSUFFICIENT_STOCK" && !isManager(a.role)) throw problem("not-permitted", { required: "MANAGER" });
    if (!flag.resolvedAt) await a.db.reviewFlag.update({ where: { id: flag.id }, data: { resolvedAt: clock.iso(), resolvedBy: a.userId } });
    res.status(204).end();
  });

  return r;
}

function shapeReturn(r: { id: string; originalSaleId: string | null; shiftId: string; businessDate: string; userId: string; reason: string; priceBasis: string; total: number; createdAt: string; originalSale?: { number: string | null } | null; lines: { id: string; saleLineId: string | null; productId: string; qty: number; unitCostMdram: number | null; taxRateBp: number; lineTax: number; discountShare: number; refundAmount: number; restock: number }[]; tenders: { method: string; amount: number }[] }, role: import("@simon/shared").Role) {
  return {
    id: r.id, originalSaleId: r.originalSaleId, originalSaleNumber: r.originalSale?.number ?? null, shiftId: r.shiftId, businessDate: r.businessDate, userId: r.userId,
    reason: r.reason, priceBasis: r.priceBasis, total: r.total, createdAt: r.createdAt,
    lines: r.lines.map((l) => {
      const line = { id: l.id, saleLineId: l.saleLineId, productId: l.productId, qty: l.qty, taxRateBp: l.taxRateBp, lineTax: l.lineTax, discountShare: l.discountShare, refundAmount: l.refundAmount, restock: l.restock === 1 };
      return seesCost(role) ? { ...line, unitCostMdram: l.unitCostMdram } : line;
    }),
    tenders: r.tenders.map((t) => ({ method: t.method, amount: t.amount })),
  };
}
