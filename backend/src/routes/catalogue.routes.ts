/** Catalogue routes. PRD §15.4. Every response passes through `shapeProduct`. */
import { Router } from "express";
import { z } from "zod";
import { CreateProductBody, ProductUnitBody, UpdateProductBody } from "@simon/shared";
import { auth, requireManager, requirePermission } from "../middleware/auth.ts";
import { problem } from "../lib/problem.ts";
import { isManager, shapeMovement, shapeProduct } from "../lib/shape.ts";
import { clock } from "../lib/time.ts";
import { addBarcode, addUnit, createProduct, listProducts, productByBarcode, productInclude, retireBarcode, updateProduct } from "../services/product.service.ts";
import { productStatuses } from "../services/stock-status.service.ts";

export function catalogueRoutes() {
  const r = Router();

  r.get("/products", async (req, res) => {
    const a = auth(req);
    const q = z.object({
      q: z.string().max(80).optional(), filter: z.enum(["all", "needs-detail", "inactive", "low-stock", "dead-stock"]).optional(),
      categoryId: z.string().optional(), cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(200).default(50),
    }).parse(req.query);
    // The list of what is incomplete includes a missing cost, and cost is the owner's (§16.5).
    if (q.filter === "needs-detail" && a.role !== "OWNER") throw problem("not-permitted", { required: "OWNER" });
    const page = await listProducts(a.db, { ...q, role: a.role });
    // The reorder suggestion travels with the row so the owner can accept it where he sees it (§13.3).
    const statuses = await productStatuses(a.db, page.items.map((p) => p.id));
    res.json({
      items: page.items.map((p) => ({ ...shapeProduct(p, a.role), stockStatus: statuses.get(p.id) ?? null })),
      nextCursor: page.nextCursor,
    });
  });

  // The hottest path in the system (§11, §21). One indexed lookup, no writes.
  r.get("/products/by-barcode/:code", async (req, res) => {
    const a = auth(req);
    const p = await productByBarcode(a.db, req.params.code);
    if (!p) throw problem("not-found");
    res.json(shapeProduct(p, a.role));
  });

  r.get("/products/:id", async (req, res) => {
    const a = auth(req);
    const p = await a.db.product.findUnique({ where: { id: req.params.id }, include: { ...productInclude, priceHistory: { orderBy: { effectiveFrom: "desc" }, take: 5 } } });
    if (!p) throw problem("not-found");
    const hasMovements = (await a.db.stockMovement.count({ where: { productId: p.id } })) > 0;
    res.json({ ...shapeProduct(p, a.role), hasMovements, priceHistory: p.priceHistory.map((h) => ({ sellPriceMdram: h.sellPriceMdram, effectiveFrom: h.effectiveFrom })) });
  });

  r.get("/products/:id/movements", async (req, res) => {
    const a = auth(req);
    const q = z.object({ cursor: z.coerce.number().int().optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(req.query);
    const rows = await a.db.stockMovement.findMany({
      where: { productId: req.params.id, ...(q.cursor ? { seq: { lt: q.cursor } } : {}) },
      orderBy: { seq: "desc" }, take: q.limit + 1, include: { user: { select: { name: true } } },
    });
    res.json({ items: rows.slice(0, q.limit).map((m) => shapeMovement(m, a.role)), nextCursor: rows.length > q.limit ? rows[q.limit - 1].seq : null });
  });

  // Quick-add from the till is open to anyone who sells (§7.4); the catalogue's extra fields are
  // for whoever runs the shop.
  r.post("/products", requirePermission("sell"), async (req, res) => {
    const a = auth(req);
    const body = CreateProductBody.parse(req.body);
    const allowed = isManager(a.role) ? body : { ...body, sku: null, categoryId: null, reorderPoint: undefined, reorderQty: undefined, trackStock: undefined };
    res.status(201).json(shapeProduct(await createProduct(a.db, a.userId, allowed), a.role));
  });

  r.get("/catalogue/snapshot", async (req, res) => {
    const a = auth(req);
    const { since } = z.object({ since: z.string().datetime().optional() }).parse(req.query);
    const serverTime = clock.iso();
    const rows = await a.db.product.findMany({ where: since ? { updatedAt: { gt: since } } : {}, include: productInclude });
    res.json({ serverTime, products: rows.map((p) => shapeProduct(p, a.role)) });
  });

  r.get("/categories", async (req, res) => {
    const rows = await auth(req).db.category.findMany({ orderBy: { name: "asc" } });
    res.json({ items: rows.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })) });
  });

  // Gated per route: a router-level `use` would also gate every router mounted after this one.
  const admin = Router();
  const adminOnly = requireManager();
  admin.patch("/products/:id", adminOnly, async (req, res) => {
    const a = auth(req);
    res.json(shapeProduct(await updateProduct(a.db, a.userId, String(req.params.id), UpdateProductBody.parse(req.body)), a.role));
  });
  admin.post("/products/:id/barcodes", adminOnly, async (req, res) => {
    const a = auth(req);
    const body = z.object({ barcode: z.string().regex(/^[0-9A-Za-z-]{1,48}$/).nullish(), isPrimary: z.boolean().default(false) }).parse(req.body);
    res.status(201).json(shapeProduct(await addBarcode(a.db, String(req.params.id), body.barcode, body.isPrimary), a.role));
  });
  admin.post("/products/:id/barcodes/:code/retire", adminOnly, async (req, res) => {
    const a = auth(req);
    res.json(shapeProduct(await retireBarcode(a.db, String(req.params.id), String(req.params.code)), a.role));
  });
  admin.post("/products/:id/units", adminOnly, async (req, res) => {
    const a = auth(req);
    res.status(201).json(shapeProduct(await addUnit(a.db, String(req.params.id), ProductUnitBody.parse(req.body)), a.role));
  });
  admin.post("/categories", adminOnly, async (req, res) => {
    const a = auth(req);
    const body = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60), parentId: z.string().uuid().nullish() }).parse(req.body);
    const c = await a.db.category.upsert({ where: { id: body.id }, create: { id: body.id, name: body.name.normalize("NFC"), parentId: body.parentId ?? null, updatedAt: clock.iso() }, update: {} });
    res.status(201).json({ id: c.id, name: c.name, parentId: c.parentId });
  });
  admin.patch("/categories/:id", adminOnly, async (req, res) => {
    const a = auth(req);
    const body = z.object({ name: z.string().trim().min(1).max(60) }).parse(req.body);
    const c = await a.db.category.update({ where: { id: String(req.params.id) }, data: { name: body.name.normalize("NFC"), updatedAt: clock.iso() } });
    res.json({ id: c.id, name: c.name, parentId: c.parentId });
  });

  r.use(admin);
  return r;
}
