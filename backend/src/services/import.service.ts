/**
 * Importing what the shop already has. PRD §19.1, §7.3, §11 `ImportBatch`/`ImportRow`, §27.38, §27.5.
 *
 * Four kinds — products, customers, opening stock, opening debts — with three guarantees:
 *
 * - **Idempotent.** Every row carries a natural key; a key already applied in any batch is skipped,
 *   never applied twice. A second run of the opening-debts file must not double a shop's debts.
 * - **Never partially applied.** A row error refuses the whole batch: a half-built catalogue is
 *   worse than no catalogue, because nobody can tell which half is missing.
 * - **Per-row errors.** A cell that is not whole in its scaled unit is reported with its line and
 *   column, never rounded (§27.38).
 *
 * Opening debts keep their original date in `DebtEntry.createdAt`, which is what §10.6 ages from —
 * the row's id sorts by when it was imported and must never be read as a date.
 */
import { createHash } from "node:crypto";
import {
  CellError, columnIndex, normalizeForSearch, parseCsv, parseDateCell, parseDramCell, parseQtyCell, uuidv7,
  type ColumnName, type ImportKind,
} from "@simon/shared";
import type { Db, Tx } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";
import { nextInternalBarcode } from "./product.service.ts";
import { postMovement } from "./stock-ledger.service.ts";
import { readSettings } from "./settings.service.ts";

export interface ImportInput {
  id: string;
  kind: ImportKind;
  fileName: string;
  content: string;
  /** Validate and report, change nothing — what the preview screen calls (§7.3). */
  dryRun?: boolean;
}

type RowStatus = "APPLIED" | "SKIPPED" | "FAILED";

export interface ImportRowResult {
  rowNumber: number;
  naturalKey: string;
  status: RowStatus;
  /** A stable code the screen translates: `not-whole:price`, `unknown-product:sku`, … */
  error?: string;
  entityId?: string;
  /** What the row will become, for the preview table. */
  preview: Record<string, string | number | null>;
}

export interface ImportResult {
  id: string;
  kind: ImportKind;
  fileName: string;
  dryRun: boolean;
  rowCount: number;
  appliedCount: number;
  skippedCount: number;
  failedCount: number;
  /** A batch of the same file already ran; its rows will skip rather than double (§11 `fileHash`). */
  duplicateOfBatchId: string | null;
  rows: ImportRowResult[];
  startedAt: string;
  completedAt: string | null;
}

/** A row that parsed, waiting to be applied. */
interface Draft {
  rowNumber: number;
  naturalKey: string;
  preview: Record<string, string | number | null>;
  /**
   * A clash with something already in the shop — a barcode on another product, a phone on another
   * customer. Checked only for rows that are actually going to be applied: on a re-run the row is
   * the same row, and its own barcode is not a conflict with itself.
   */
  conflict?: string;
  apply: (tx: Tx, userId: string) => Promise<string>;
}

const hashOf = (content: string) => createHash("sha256").update(content).digest("hex");
const cell = (cells: readonly string[], index: number) => (index >= 0 ? (cells[index] ?? "") : "");

/** `not-whole:price` — the reason and the column it was in, so the screen can point at it. */
const cellFailure = (err: unknown, column: ColumnName) =>
  err instanceof CellError ? `${err.reason}:${column}` : `not-a-number:${column}`;

export async function runImport(db: Db, userId: string, input: ImportInput): Promise<ImportResult> {
  const existing = await db.importBatch.findUnique({ where: { id: input.id }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
  if (existing) return shapeStored(existing, input);

  const parsed = parseCsv(input.content);
  if (parsed.rows.length === 0) throw problem("malformed-request", { field: "content", reason: "empty-file" });

  const startedAt = clock.iso();
  const settings = await readSettings(db);
  const fileHash = hashOf(input.content);
  const duplicate = await db.importBatch.findFirst({ where: { kind: input.kind, fileHash, completedAt: { not: null } }, orderBy: { startedAt: "desc" } });

  const drafts: Draft[] = [];
  const failures: ImportRowResult[] = [];
  const builder = BUILDERS[input.kind];
  const context = await builder.load(db, parsed.header);

  for (const row of parsed.rows) {
    try {
      drafts.push(await builder.draft(row.lineNumber, row.cells, context, settings["shop.timezone"]));
    } catch (err) {
      failures.push({
        rowNumber: row.lineNumber,
        naturalKey: "",
        status: "FAILED",
        error: err instanceof RowError ? err.code : "malformed-row",
        preview: err instanceof RowError ? err.preview : {},
      });
    }
  }

  // A key repeated inside the file is as double as a key repeated across two runs.
  const seen = new Set<string>();
  for (const draft of drafts) {
    if (seen.has(draft.naturalKey)) failures.push({ rowNumber: draft.rowNumber, naturalKey: draft.naturalKey, status: "FAILED", error: "duplicate-in-file", preview: draft.preview });
    seen.add(draft.naturalKey);
  }

  const alreadyApplied = new Set(
    (await db.importRow.findMany({ where: { naturalKey: { in: drafts.map((d) => d.naturalKey) }, status: "APPLIED", batch: { kind: input.kind } }, select: { naturalKey: true } })).map((r) => r.naturalKey),
  );

  for (const draft of drafts) {
    if (draft.conflict && !alreadyApplied.has(draft.naturalKey)) {
      failures.push({ rowNumber: draft.rowNumber, naturalKey: draft.naturalKey, status: "FAILED", error: draft.conflict, preview: draft.preview });
    }
  }

  // Never partially applied: one bad row refuses the file, and the owner fixes it and runs it again.
  const refused = failures.length > 0;
  const rows: ImportRowResult[] = [...failures];

  if (refused || input.dryRun) {
    for (const d of drafts) {
      const alreadyFailed = failures.some((f) => f.rowNumber === d.rowNumber);
      if (alreadyFailed) continue;
      rows.push({
        rowNumber: d.rowNumber, naturalKey: d.naturalKey, preview: d.preview,
        status: alreadyApplied.has(d.naturalKey) ? "SKIPPED" : refused ? "SKIPPED" : "APPLIED",
        error: alreadyApplied.has(d.naturalKey) ? "already-imported" : refused ? "batch-refused" : undefined,
      });
    }
    rows.sort((a, b) => a.rowNumber - b.rowNumber);
    const result: ImportResult = {
      id: input.id, kind: input.kind, fileName: input.fileName, dryRun: Boolean(input.dryRun),
      rowCount: parsed.rows.length,
      appliedCount: input.dryRun && !refused ? rows.filter((r) => r.status === "APPLIED").length : 0,
      skippedCount: rows.filter((r) => r.status === "SKIPPED").length,
      failedCount: failures.length,
      duplicateOfBatchId: duplicate?.id ?? null,
      rows, startedAt, completedAt: null,
    };
    // A refused batch is still recorded, so "what happened when I pressed the button" is a query.
    if (!input.dryRun) await store(db, userId, input, fileHash, result);
    return result;
  }

  const applied = await db.$transaction(async (tx) => {
    const out: ImportRowResult[] = [];
    for (const d of drafts) {
      if (alreadyApplied.has(d.naturalKey)) {
        out.push({ rowNumber: d.rowNumber, naturalKey: d.naturalKey, status: "SKIPPED", error: "already-imported", preview: d.preview });
        continue;
      }
      const entityId = await d.apply(tx, userId);
      out.push({ rowNumber: d.rowNumber, naturalKey: d.naturalKey, status: "APPLIED", entityId, preview: d.preview });
    }
    return out;
  });

  const result: ImportResult = {
    id: input.id, kind: input.kind, fileName: input.fileName, dryRun: false,
    rowCount: parsed.rows.length,
    appliedCount: applied.filter((r) => r.status === "APPLIED").length,
    skippedCount: applied.filter((r) => r.status === "SKIPPED").length,
    failedCount: 0,
    duplicateOfBatchId: duplicate?.id ?? null,
    rows: applied.sort((a, b) => a.rowNumber - b.rowNumber),
    startedAt, completedAt: clock.iso(),
  };
  await store(db, userId, input, fileHash, result);
  return result;
}

async function store(db: Db, userId: string, input: ImportInput, fileHash: string, result: ImportResult) {
  await db.$transaction(async (tx) => {
    await tx.importBatch.create({
      data: {
        id: input.id, kind: input.kind, fileHash, rowCount: result.rowCount,
        appliedCount: result.appliedCount, skippedCount: result.skippedCount, failedCount: result.failedCount,
        startedAt: result.startedAt, completedAt: result.completedAt, userId,
      },
    });
    for (const r of result.rows) {
      await tx.importRow.create({
        data: { id: uuidv7(), batchId: input.id, rowNumber: r.rowNumber, naturalKey: r.naturalKey, status: r.status, entityId: r.entityId ?? null, error: r.error ?? null },
      });
    }
    await writeAudit(tx, {
      userId, action: "import.run", entityType: "ImportBatch", entityId: input.id,
      after: { kind: input.kind, fileName: input.fileName, applied: result.appliedCount, skipped: result.skippedCount, failed: result.failedCount },
    });
  });
}

function shapeStored(batch: { id: string; kind: string; fileHash: string; rowCount: number; appliedCount: number; skippedCount: number; failedCount: number; startedAt: string; completedAt: string | null; rows: Array<{ rowNumber: number; naturalKey: string; status: string; entityId: string | null; error: string | null }> }, input: Pick<ImportInput, "fileName">): ImportResult {
  return {
    id: batch.id, kind: batch.kind as ImportKind, fileName: input.fileName, dryRun: false,
    rowCount: batch.rowCount, appliedCount: batch.appliedCount, skippedCount: batch.skippedCount, failedCount: batch.failedCount,
    duplicateOfBatchId: null,
    rows: batch.rows.map((r) => ({ rowNumber: r.rowNumber, naturalKey: r.naturalKey, status: r.status as RowStatus, entityId: r.entityId ?? undefined, error: r.error ?? undefined, preview: {} })),
    startedAt: batch.startedAt, completedAt: batch.completedAt,
  };
}

/** A row that cannot be applied, with the reason and enough of the row to show the person. */
class RowError extends Error {
  readonly code: string;
  readonly preview: Record<string, string | number | null>;
  constructor(code: string, preview: Record<string, string | number | null> = {}) {
    super(code);
    this.code = code;
    this.preview = preview;
  }
}

interface Builder {
  load: (db: Db, header: readonly string[]) => Promise<BuilderContext>;
  draft: (rowNumber: number, cells: readonly string[], ctx: BuilderContext, timeZone: string) => Promise<Draft>;
}

interface BuilderContext {
  columns: Partial<Record<ColumnName, number>>;
  products: Map<string, { id: string; name: string; decimalPlaces: number; stockUom: string }>;
  barcodes: Map<string, string>;
  customers: Map<string, { id: string; fullName: string | null }>;
}

async function loadContext(header: readonly string[], columns: readonly ColumnName[]): Promise<BuilderContext> {
  const ctx: BuilderContext = { columns: {}, products: new Map(), barcodes: new Map(), customers: new Map() };
  for (const c of columns) ctx.columns[c] = columnIndex(header, c);
  return ctx;
}

async function withProducts(db: Db, ctx: BuilderContext) {
  const products = await db.product.findMany({ select: { id: true, name: true, sku: true, decimalPlaces: true, stockUom: true, barcodes: { select: { barcode: true } } } });
  for (const p of products) {
    const entry = { id: p.id, name: p.name, decimalPlaces: p.decimalPlaces, stockUom: p.stockUom };
    if (p.sku) ctx.products.set(`sku:${p.sku}`, entry);
    for (const b of p.barcodes) {
      ctx.products.set(`barcode:${b.barcode}`, entry);
      ctx.barcodes.set(b.barcode, p.id);
    }
    ctx.products.set(`name:${normalizeForSearch(p.name)}`, entry);
  }
  return ctx;
}

async function withCustomers(db: Db, ctx: BuilderContext) {
  const customers = await db.customer.findMany({ where: { mergedIntoId: null }, select: { id: true, fullName: true, phone: true } });
  for (const c of customers) {
    if (c.phone) ctx.customers.set(`phone:${c.phone}`, c);
    if (c.fullName) ctx.customers.set(`name:${normalizeForSearch(c.fullName)}`, c);
  }
  return ctx;
}

const requireColumn = (ctx: BuilderContext, column: ColumnName) => {
  if ((ctx.columns[column] ?? -1) < 0) throw problem("malformed-request", { field: "content", reason: "missing-column", column });
};

const BUILDERS: Record<ImportKind, Builder> = {
  PRODUCTS: {
    load: async (db, header) => {
      const ctx = await withProducts(db, await loadContext(header, ["name", "price", "barcode", "sku", "unit", "qty", "cost"]));
      requireColumn(ctx, "name");
      requireColumn(ctx, "price");
      return ctx;
    },
    draft: async (rowNumber, cells, ctx) => {
      const name = cell(cells, ctx.columns.name!).trim();
      const barcode = cell(cells, ctx.columns.barcode ?? -1).trim();
      const sku = cell(cells, ctx.columns.sku ?? -1).trim();
      const unit = cell(cells, ctx.columns.unit ?? -1).trim() || "հատ";
      const preview = { name, barcode: barcode || null, sku: sku || null, unit, price: null as number | null };
      if (!name) throw new RowError("missing:name", preview);
      let price: number;
      try { price = parseDramCell(cell(cells, ctx.columns.price!)); } catch (err) { throw new RowError(cellFailure(err, "price"), preview); }
      preview.price = price;
      const naturalKey = sku ? `sku:${sku}` : barcode ? `barcode:${barcode}` : `name:${normalizeForSearch(name)}`;
      const conflict = barcode && ctx.barcodes.has(barcode) ? "duplicate-barcode:barcode" : undefined;
      // A unit that divides (metre, kilogram, litre) carries three decimals; a piece carries none.
      const decimalPlaces = /^(մ|կգ|լ|m|kg|l)$/i.test(unit) ? 3 : 0;
      return {
        rowNumber, naturalKey, preview, conflict,
        apply: async (tx, userId) => {
          const id = uuidv7();
          const now = clock.iso();
          await tx.product.create({
            data: { id, name: name.normalize("NFC"), nameSearch: normalizeForSearch(name), sku: sku || null, stockUom: unit, decimalPlaces, sellPriceMdram: price * 1000, createdAt: now, updatedAt: now },
          });
          await tx.productUnit.create({ data: { id: uuidv7(), productId: id, uom: unit, factorToStockUom: 1, role: "STOCK", updatedAt: now } });
          await tx.productBarcode.create({ data: { id: uuidv7(), productId: id, barcode: barcode || (await nextInternalBarcode(tx)), isPrimary: 1, updatedAt: now } });
          await tx.priceHistory.create({ data: { id: uuidv7(), productId: id, sellPriceMdram: price * 1000, effectiveFrom: now, changedBy: userId } });
          return id;
        },
      };
    },
  },

  CUSTOMERS: {
    load: async (db, header) => {
      const ctx = await withCustomers(db, await loadContext(header, ["name", "phone", "limit", "note"]));
      requireColumn(ctx, "name");
      return ctx;
    },
    draft: async (rowNumber, cells, ctx) => {
      const fullName = cell(cells, ctx.columns.name!).trim();
      const phone = cell(cells, ctx.columns.phone ?? -1).replace(/[\s ()-]/g, "").trim();
      const preview = { name: fullName, phone: phone || null, limit: null as number | null };
      if (!fullName) throw new RowError("missing:name", preview);
      let limit = 0;
      try { limit = parseDramCell(cell(cells, ctx.columns.limit ?? -1), { required: false }); } catch (err) { throw new RowError(cellFailure(err, "limit"), preview); }
      preview.limit = limit;
      const naturalKey = phone ? `phone:${phone}` : `name:${normalizeForSearch(fullName)}`;
      const conflict = phone && ctx.customers.has(`phone:${phone}`) ? "duplicate-phone:phone" : undefined;
      return {
        rowNumber, naturalKey, preview, conflict,
        apply: async (tx) => {
          const id = uuidv7();
          const now = clock.iso();
          const settings = await readSettings(tx);
          await tx.customer.create({
            data: {
              id, fullName: fullName.normalize("NFC"), nameSearch: normalizeForSearch(fullName), phone: phone || null,
              creditLimit: limit || settings["debt.defaultLimit"], notes: cell(cells, ctx.columns.note ?? -1).trim(), createdAt: now, updatedAt: now,
            },
          });
          return id;
        },
      };
    },
  },

  OPENING_STOCK: {
    load: async (db, header) => {
      const ctx = await withProducts(db, await loadContext(header, ["name", "sku", "barcode", "qty", "cost"]));
      requireColumn(ctx, "qty");
      return ctx;
    },
    draft: async (rowNumber, cells, ctx) => {
      const sku = cell(cells, ctx.columns.sku ?? -1).trim();
      const barcode = cell(cells, ctx.columns.barcode ?? -1).trim();
      const name = cell(cells, ctx.columns.name ?? -1).trim();
      const key = sku ? `sku:${sku}` : barcode ? `barcode:${barcode}` : name ? `name:${normalizeForSearch(name)}` : "";
      const product = ctx.products.get(key);
      const preview = { product: product?.name ?? (name || key), qty: null as number | null, cost: null as number | null };
      if (!product) throw new RowError("unknown-product:name", preview);
      let qty: number;
      try { qty = parseQtyCell(cell(cells, ctx.columns.qty!), product.decimalPlaces); } catch (err) { throw new RowError(cellFailure(err, "qty"), preview); }
      let cost = 0;
      try { cost = parseDramCell(cell(cells, ctx.columns.cost ?? -1), { required: false }); } catch (err) { throw new RowError(cellFailure(err, "cost"), preview); }
      preview.qty = qty;
      preview.cost = cost || null;
      return {
        rowNumber, naturalKey: `stock:${key}`, preview,
        apply: async (tx, userId) => {
          const posted = await postMovement(tx, {
            productId: product.id, type: "OPENING_BALANCE", qtyDelta: qty,
            unitCostMdram: cost ? cost * 1000 : null, source: { type: "ImportBatch", id: `opening-stock` }, userId,
          });
          return posted.movement.id;
        },
      };
    },
  },

  OPENING_DEBTS: {
    load: async (db, header) => {
      const ctx = await withCustomers(db, await loadContext(header, ["name", "phone", "amount", "date", "note"]));
      requireColumn(ctx, "amount");
      requireColumn(ctx, "date");
      return ctx;
    },
    draft: async (rowNumber, cells, ctx) => {
      const phone = cell(cells, ctx.columns.phone ?? -1).replace(/[\s ()-]/g, "").trim();
      const name = cell(cells, ctx.columns.name ?? -1).trim();
      const customer = ctx.customers.get(phone ? `phone:${phone}` : `name:${normalizeForSearch(name)}`);
      const preview = { customer: customer?.fullName ?? (name || phone), amount: null as number | null, date: null as string | null };
      if (!customer) throw new RowError("unknown-customer:name", preview);
      let amount: number;
      try { amount = parseDramCell(cell(cells, ctx.columns.amount!)); } catch (err) { throw new RowError(cellFailure(err, "amount"), preview); }
      let date: string;
      try { date = parseDateCell(cell(cells, ctx.columns.date!)); } catch (err) { throw new RowError(cellFailure(err, "date"), preview); }
      preview.amount = amount;
      preview.date = date;
      // Mid-morning shop-local, so the charge lands on the day the paper book says whatever the offset.
      const createdAt = new Date(Date.parse(`${date}T09:00:00Z`)).toISOString();
      return {
        rowNumber, naturalKey: `debt:${customer.id}:${date}:${amount}`, preview,
        apply: async (tx, userId) => {
          const id = uuidv7();
          await tx.debtEntry.create({ data: { id, customerId: customer.id, type: "CHARGE", amount, createdAt, userId } });
          await tx.customer.update({ where: { id: customer.id }, data: { updatedAt: clock.iso() } });
          return id;
        },
      };
    },
  },
};

export async function loadImport(db: Db, id: string) {
  const batch = await db.importBatch.findUnique({ where: { id }, include: { rows: { orderBy: { rowNumber: "asc" } }, } });
  if (!batch) throw problem("not-found");
  return batch;
}

export async function listImports(db: Db) {
  return db.importBatch.findMany({ orderBy: { startedAt: "desc" }, take: 20 });
}
