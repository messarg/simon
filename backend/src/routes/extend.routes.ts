/**
 * Phase 6 (v2, §9): stocktake, purchase orders and shelf labels. PRD §6.8, §13.3, §13.4, §18.
 * All online-only, like the rest of the buying side (§14.5).
 */
import { Router } from "express";
import { z } from "zod";
import { LabelPrintBody, PurchaseOrderBody, StartStocktakeBody, StocktakeCountBody } from "@simon/shared";
import { auth, requireManager, requireOwner, requirePermission } from "../middleware/auth.ts";
import { problem } from "../lib/problem.ts";
import { isManager, seesCost, stripCost } from "../lib/shape.ts";
import { labelPrinter } from "../lib/hardware/label-printer.ts";
import { labelsFor, printLabels } from "../services/label.service.ts";
import {
  createPurchaseOrder, draftsFromSuggestions, listPurchaseOrders, loadPurchaseOrder, reorderSuggestions, transition as poTransition, updateDraft,
} from "../services/purchase-order.service.ts";
import { approveStocktake, listStocktakes, loadStocktake, openStocktake, recordCount, startStocktake, transition as stTransition } from "../services/stocktake.service.ts";

export function extendRoutes() {
  const r = Router();
  const stocktake = requirePermission("stocktake");
  const receive = requirePermission("receive");
  const labels = requirePermission("labels");
  const manager = requireManager();
  // An order's lines carry the prices it was placed at: cost, and so the owner's (§16.5). A
  // manager or a receiver sees a sent order's quantities; editing one would mean editing prices
  // they cannot see, so drafting and sending orders stays with the owner.
  const owner = requireOwner();
  const actor = (req: Express.Request) => { const a = auth(req); return { userId: a.userId, role: a.role, deviceId: a.deviceId }; };

  // ── Stocktake (§6.8) ──────────────────────────────────────────────────────
  // A blind count: whoever counts is not told what the books say until the count goes to review.
  const view = async (req: Express.Request, id: string) => {
    const a = auth(req);
    const st = await loadStocktake(a.db, id, { includeCost: false, revealExpected: true });
    const reveal = isManager(a.role) || st.status !== "COUNTING";
    return loadStocktake(a.db, id, { includeCost: seesCost(a.role), revealExpected: reveal });
  };

  r.get("/stocktakes", stocktake, async (req, res) => {
    const a = auth(req);
    const rows = await listStocktakes(a.db);
    res.json({
      items: rows.map((s) => ({
        id: s.id, status: s.status, startedAt: s.startedAt, approvedAt: s.approvedAt, abandonedAt: s.abandonedAt, lines: s._count.lines,
        ...(seesCost(a.role) ? { varianceTotal: s.varianceTotal } : {}),
      })),
    });
  });
  r.get("/stocktakes/current", stocktake, async (req, res) => {
    const open = await openStocktake(auth(req).db);
    res.json(open ? await view(req, open.id) : null);
  });
  r.post("/stocktakes", stocktake, async (req, res) => {
    const st = await startStocktake(auth(req).db, actor(req), StartStocktakeBody.parse(req.body));
    res.status(201).json(await view(req, st.id));
  });
  r.get("/stocktakes/:id", stocktake, async (req, res) => { res.json(await view(req, String(req.params.id))); });
  r.put("/stocktakes/:id/counts/:productId", stocktake, async (req, res) => {
    const a = auth(req);
    const line = await recordCount(a.db, actor(req), String(req.params.id), String(req.params.productId), StocktakeCountBody.parse(req.body));
    res.json({ productId: line.productId, countedQty: line.countedQty, countedAt: line.countedAt });
  });
  r.post("/stocktakes/:id/review", stocktake, async (req, res) => {
    await stTransition(auth(req).db, actor(req), String(req.params.id), "REVIEW");
    res.json(await view(req, String(req.params.id)));
  });
  r.post("/stocktakes/:id/abandon", manager, async (req, res) => {
    await stTransition(auth(req).db, actor(req), String(req.params.id), "ABANDONED");
    res.json(await view(req, String(req.params.id)));
  });
  r.post("/stocktakes/:id/approve", manager, async (req, res) => {
    await approveStocktake(auth(req).db, actor(req), String(req.params.id));
    res.json(await view(req, String(req.params.id)));
  });

  // ── Purchase orders (§11, §13.3) ─────────────────────────────────────────
  // Whoever receives sees what was ordered against a sent order, never what it was ordered at (§16.5).
  const shapeOrder = (po: Awaited<ReturnType<typeof loadPurchaseOrder>>, admin: boolean) => {
    const out = {
      id: po.id, number: po.number, status: po.status, supplierId: po.supplierId, supplierName: po.supplier.name, supplierPhone: po.supplier.phone,
      expectedAt: po.expectedAt, note: po.note, createdAt: po.createdAt, openedAt: po.openedAt, cancelledAt: po.cancelledAt,
      receipts: po.receipts,
      lines: po.lines.map((l) => ({
        id: l.id, productId: l.productId, productName: l.productName, sku: l.sku, barcode: l.barcode, stockUom: l.stockUom, decimalPlaces: l.decimalPlaces,
        uom: l.uom || l.stockUom, factorToStockUom: l.factorToStockUom, qtyOrdered: l.qtyOrdered, qtyReceived: l.qtyReceived, unitCostMdram: l.unitCostMdram,
      })),
      ...(admin ? { total: po.total } : {}),
    };
    return admin ? out : stripCost(out, "EMPLOYEE");
  };

  r.get("/purchase-orders", receive, async (req, res) => {
    const a = auth(req);
    const q = z.object({ status: z.string().max(60).optional(), supplierId: z.string().max(60).optional() }).parse(req.query);
    const requested = q.status?.split(",").filter(Boolean) ?? [];
    const status = seesCost(a.role) ? requested : ["OPEN", "PARTIAL"];
    const rows = await listPurchaseOrders(a.db, { status, supplierId: q.supplierId });
    res.json({
      items: rows.map((po) => ({
        id: po.id, number: po.number, status: po.status, supplierId: po.supplierId, supplierName: po.supplier.name,
        expectedAt: po.expectedAt, createdAt: po.createdAt, lines: po._count.lines, ...(seesCost(a.role) ? { total: po.total } : {}),
      })),
    });
  });
  r.get("/purchase-orders/suggestions", owner, async (req, res) => { res.json({ items: await reorderSuggestions(auth(req).db) }); });
  r.post("/purchase-orders/from-suggestions", owner, async (req, res) => {
    const a = auth(req);
    const { supplierId } = z.object({ supplierId: z.string().max(60).optional() }).parse(req.body ?? {});
    const out = await draftsFromSuggestions(a.db, actor(req), { supplierId });
    res.status(201).json({ created: out.created.map((po) => shapeOrder(po, true)), withoutSupplier: out.withoutSupplier });
  });
  r.get("/purchase-orders/:id", receive, async (req, res) => {
    const a = auth(req);
    const po = await loadPurchaseOrder(a.db, String(req.params.id));
    // A draft is the owner's working paper; everyone else sees an order once it has been sent.
    if (!seesCost(a.role) && !["OPEN", "PARTIAL"].includes(po.status)) throw problem("not-found");
    res.json(shapeOrder(po, seesCost(a.role)));
  });
  r.post("/purchase-orders", owner, async (req, res) => {
    const a = auth(req);
    res.status(201).json(shapeOrder(await createPurchaseOrder(a.db, actor(req), PurchaseOrderBody.parse(req.body)), true));
  });
  r.put("/purchase-orders/:id", owner, async (req, res) => {
    const a = auth(req);
    res.json(shapeOrder(await updateDraft(a.db, actor(req), String(req.params.id), PurchaseOrderBody.parse(req.body)), true));
  });
  r.post("/purchase-orders/:id/open", owner, async (req, res) => {
    res.json(shapeOrder(await poTransition(auth(req).db, actor(req), String(req.params.id), "OPEN"), true));
  });
  r.post("/purchase-orders/:id/cancel", owner, async (req, res) => {
    res.json(shapeOrder(await poTransition(auth(req).db, actor(req), String(req.params.id), "CANCELLED"), true));
  });

  // ── Labels (§18) ─────────────────────────────────────────────────────────
  r.get("/labels", labels, async (req, res) => {
    const a = auth(req);
    const { ids } = z.object({ ids: z.string().min(1).max(20_000) }).parse(req.query);
    const labels = await labelsFor(a.db, ids.split(",").filter(Boolean).slice(0, 500));
    res.json({ items: [...labels.values()], printer: labelPrinter.kind() });
  });
  r.post("/print/labels", labels, async (req, res) => {
    const a = auth(req);
    res.json(await printLabels(a.db, LabelPrintBody.parse(req.body).items));
  });

  return r;
}
