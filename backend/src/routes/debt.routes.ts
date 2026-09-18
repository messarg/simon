/** Customers and the debt book. PRD §15.4 (Customers), §15.3 (`POST /debt-payments`). */
import { Router } from "express";
import { z } from "zod";
import { CreateCustomerBody, DebtPaymentBody, ReverseDebtPaymentBody, UpdateCustomerBody } from "@simon/shared";
import { auth, requireManager, requirePermission } from "../middleware/auth.ts";
import { problem } from "../lib/problem.ts";
import { isManager, shapeCustomer } from "../lib/shape.ts";
import { agingReport, createCustomer, customerLedger, eraseCustomer, listCustomers, mergeCustomer, updateCustomer } from "../services/customer.service.ts";
import { allProjections, reverseDebtPayment, submitDebtPayment } from "../services/debt.service.ts";

export function debtRoutes() {
  const r = Router();
  const adminOnly = requireManager();
  // The debt book is a job of its own (§16.4): who owes what is not every cashier's business.
  const debt = requirePermission("debt");
  const actor = (req: Express.Request) => { const a = auth(req); return { userId: a.userId, role: a.role, deviceId: a.deviceId }; };

  r.get("/customers", debt, async (req, res) => {
    const a = auth(req);
    const q = z.object({ q: z.string().max(80).optional(), includeInactive: z.enum(["true", "false"]).optional(), limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(req.query);
    const rows = await listCustomers(a.db, { q: q.q, includeInactive: q.includeInactive === "true" && isManager(a.role), limit: q.limit });
    res.json({ items: rows.map((row) => shapeCustomer(row.customer, a.role, row)) });
  });

  // For the till's offline cache: names, balances, limits and the block flag (§14.4).
  r.get("/customers/snapshot", debt, async (req, res) => {
    const a = auth(req);
    const { since } = z.object({ since: z.string().datetime().optional() }).parse(req.query);
    const serverTime = new Date().toISOString();
    const rows = await a.db.customer.findMany({ where: { mergedIntoId: null, ...(since ? { updatedAt: { gt: since } } : {}) } });
    const projections = await allProjections(a.db);
    res.json({ serverTime, customers: rows.map((c) => shapeCustomer(c, a.role, projections.get(c.id) ?? { outstanding: 0, oldestChargeDays: null, overdue: 0 })) });
  });

  r.get("/customers/aging", debt, async (req, res) => { res.json(await agingReport(auth(req).db)); });

  r.post("/customers", debt, async (req, res) => {
    const a = auth(req);
    const c = await createCustomer(a.db, CreateCustomerBody.parse(req.body));
    res.status(201).json(shapeCustomer(c, a.role, { outstanding: 0, oldestChargeDays: null, overdue: 0 }));
  });

  r.get("/customers/:id/ledger", debt, async (req, res) => {
    const a = auth(req);
    const ledger = await customerLedger(a.db, String(req.params.id));
    res.json({ ...ledger, customer: shapeCustomer(ledger.customer, a.role, { outstanding: ledger.outstanding, oldestChargeDays: ledger.aging.oldestChargeDays, overdue: ledger.overdue }) });
  });

  r.patch("/customers/:id", adminOnly, async (req, res) => {
    const a = auth(req);
    res.json(shapeCustomer(await updateCustomer(a.db, a.userId, String(req.params.id), UpdateCustomerBody.parse(req.body)), a.role));
  });

  r.post("/customers/:id/merge", adminOnly, async (req, res) => {
    const a = auth(req);
    const { intoId } = z.object({ intoId: z.string().uuid() }).parse(req.body);
    res.json(await mergeCustomer(a.db, a.userId, String(req.params.id), intoId));
  });

  r.post("/customers/:id/erase", adminOnly, async (req, res) => {
    const a = auth(req);
    const c = await eraseCustomer(a.db, a.userId, String(req.params.id));
    res.json(shapeCustomer(c, a.role));
  });

  r.post("/debt-payments", debt, async (req, res) => {
    const a = auth(req);
    res.json(await submitDebtPayment(a.db, actor(req), DebtPaymentBody.parse(req.body)));
  });

  r.post("/debt-payments/:id/reverse", debt, async (req, res) => {
    const a = auth(req);
    const body = ReverseDebtPaymentBody.parse(req.body);
    if (!body.reason) throw problem("malformed-request", { field: "reason" });
    res.json(await reverseDebtPayment(a.db, actor(req), String(req.params.id), body));
  });

  return r;
}
