/**
 * Stocktake sessions. PRD §6.8, §13.4, §11 `Stocktake`, J-level exit criterion of Phase 6: the
 * owner counts stock without closing the shop.
 *
 * Starting a count reads every tracked product's quantity at one ledger position. Counting records,
 * per line, the ledger position the count was taken at, so what sold in between is not booked as
 * shrinkage. Approval posts one `STOCKTAKE` movement per line that differs, at the average at that
 * moment (§10.4), and it is the only transition that touches stock. Approval also clears the
 * recount flags for the products it counted — those flags were the recount list (§13.6).
 */
import type { StartStocktakeBody, StocktakeCountBody } from "@simon/shared";
import { acceptsCounts, canTransition, lineVariance, reviewOrder, summarize, type CountedLine, type StocktakeStatus } from "../domain/stocktake.ts";
import type { Db, Tx } from "../lib/db.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { writeAudit } from "./audit.service.ts";
import type { Actor } from "./sale.service.ts";
import { postMovement } from "./stock-ledger.service.ts";
import { uuidv7 } from "@simon/shared";

const OPEN_STATUSES = ["COUNTING", "REVIEW"];

async function ledgerPosition(tx: Tx | Db) {
  return (await tx.stockMovement.aggregate({ _max: { seq: true } }))._max.seq ?? 0;
}

export async function startStocktake(db: Db, actor: Actor, body: StartStocktakeBody) {
  return db.$transaction(async (tx) => {
    const existing = await tx.stocktake.findUnique({ where: { id: body.id } });
    if (existing) return existing;
    // One count at a time: two overlapping counts would both adjust the same shelf.
    const open = await tx.stocktake.findFirst({ where: { status: { in: OPEN_STATUSES } } });
    if (open) throw problem("illegal-transition", { stocktakeId: open.id, status: open.status });
    if (body.categoryId && !(await tx.category.findUnique({ where: { id: body.categoryId } }))) throw problem("not-found", { entity: "Category" });

    // Inside the writer's transaction, so the cache and the ledger position agree (§13.1).
    const snapshotSeq = await ledgerPosition(tx);
    const products = await tx.product.findMany({
      where: { trackStock: 1, isActive: 1, ...(body.categoryId ? { categoryId: body.categoryId } : {}) },
      select: { id: true, stockQty: true },
    });
    const now = clock.iso();
    const stocktake = await tx.stocktake.create({
      data: { id: body.id, status: "COUNTING", startedAt: now, startedBy: actor.userId, note: body.note?.normalize("NFC") ?? "", snapshotSeq, categoryId: body.categoryId ?? null },
    });
    for (const p of products) {
      await tx.stocktakeLine.create({ data: { id: uuidv7(), stocktakeId: body.id, productId: p.id, expectedQty: p.stockQty } });
    }
    await writeAudit(tx, { userId: actor.userId, action: "stocktake.start", entityType: "Stocktake", entityId: body.id, after: { lines: products.length, categoryId: body.categoryId ?? null } });
    return stocktake;
  });
}

export async function recordCount(db: Db, actor: Actor, stocktakeId: string, productId: string, body: StocktakeCountBody) {
  return db.$transaction(async (tx) => {
    const st = await tx.stocktake.findUnique({ where: { id: stocktakeId } });
    if (!st) throw problem("not-found");
    if (!acceptsCounts(st.status as StocktakeStatus)) throw problem("illegal-transition", { status: st.status });
    const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true, decimalPlaces: true, createdAt: true, categoryId: true } });
    if (!product) throw problem("not-found", { entity: "Product" });
    if (body.countedQty % 10 ** (3 - product.decimalPlaces) !== 0) throw problem("malformed-request", { field: "countedQty" });

    let line = await tx.stocktakeLine.findUnique({ where: { stocktakeId_productId: { stocktakeId, productId } } });
    if (!line) {
      // A product created after the count began had nothing on the shelf at the snapshot; everything
      // it has since came through the ledger, which the expectation already follows.
      const inScope = !st.categoryId || product.categoryId === st.categoryId;
      if (product.createdAt <= st.startedAt || !inScope) throw problem("not-found", { entity: "StocktakeLine", reason: "not-in-this-count" });
      line = await tx.stocktakeLine.create({ data: { id: uuidv7(), stocktakeId, productId, expectedQty: 0 } });
    }
    const countedQty = body.mode === "add" ? (line.countedQty ?? 0) + body.countedQty : body.countedQty;
    return tx.stocktakeLine.update({
      where: { id: line.id },
      data: { countedQty, countedSeq: await ledgerPosition(tx), countedAt: clock.iso(), countedBy: actor.userId },
    });
  });
}

/** Net stock change for each product between the snapshot and each line's count, stocktake postings excluded. */
async function movedSince(db: Db | Tx, st: { snapshotSeq: number }, lines: ReadonlyArray<{ productId: string; countedSeq: number | null }>) {
  const counted = lines.filter((l) => l.countedSeq !== null);
  const out = new Map<string, number>();
  if (!counted.length) return out;
  const upTo = Math.max(...counted.map((l) => l.countedSeq!));
  const rows = await db.stockMovement.findMany({
    where: { productId: { in: counted.map((l) => l.productId) }, seq: { gt: st.snapshotSeq, lte: upTo }, type: { not: "STOCKTAKE" } },
    select: { productId: true, seq: true, qtyDelta: true },
  });
  const countedAt = new Map(counted.map((l) => [l.productId, l.countedSeq!]));
  for (const r of rows) {
    if (r.seq > countedAt.get(r.productId)!) continue;
    out.set(r.productId, (out.get(r.productId) ?? 0) + r.qtyDelta);
  }
  return out;
}

async function evaluate(db: Db | Tx, stocktakeId: string) {
  const st = await db.stocktake.findUnique({ where: { id: stocktakeId }, include: { lines: true } });
  if (!st) throw problem("not-found");
  const products = new Map((await db.product.findMany({
    where: { id: { in: st.lines.map((l) => l.productId) } },
    select: { id: true, name: true, stockUom: true, decimalPlaces: true, avgCostMdram: true, categoryId: true, barcodes: { select: { barcode: true }, where: { retiredAt: null } } },
  })).map((p) => [p.id, p]));
  const moved = await movedSince(db, st, st.lines);
  const counted: CountedLine[] = st.lines.map((l) => ({
    productId: l.productId, snapshotQty: l.expectedQty, countedQty: l.countedQty,
    movedSinceSnapshot: moved.get(l.productId) ?? 0, avgCostMdram: products.get(l.productId)?.avgCostMdram ?? null,
  }));
  return { st, products, counted };
}

export async function loadStocktake(db: Db, stocktakeId: string, opts: { includeCost: boolean; revealExpected: boolean }) {
  const { st, products, counted } = await evaluate(db, stocktakeId);
  const variances = new Map(counted.map((c) => [c.productId, lineVariance(c)]));
  const summary = summarize(counted);
  const lines = st.lines.map((l) => {
    const p = products.get(l.productId);
    const v = variances.get(l.productId);
    const approved = st.status === "APPROVED";
    return {
      productId: l.productId, productName: p?.name ?? "", uom: p?.stockUom ?? "", decimalPlaces: p?.decimalPlaces ?? 0,
      barcodes: p?.barcodes.map((b) => b.barcode) ?? [],
      countedQty: l.countedQty, countedAt: l.countedAt,
      // A blind count: whoever is counting is not told what the books say (§6.8's review shows it).
      ...(opts.revealExpected ? {
        expectedQty: v?.expectedAtCount ?? l.expectedQty,
        varianceQty: approved ? l.varianceQty : (v?.varianceQty ?? null),
      } : {}),
      ...(opts.includeCost && opts.revealExpected ? { varianceValue: approved ? l.varianceValue : (v?.varianceValue ?? null) } : {}),
    };
  });
  const differing = reviewOrder([...variances.values()].filter((v): v is NonNullable<typeof v> => v !== null)).map((v) => v.productId);
  return {
    id: st.id, status: st.status, startedAt: st.startedAt, approvedAt: st.approvedAt, abandonedAt: st.abandonedAt,
    categoryId: st.categoryId, note: st.note,
    progress: { total: st.lines.length, counted: summary.counted },
    ...(opts.revealExpected ? { differing } : {}),
    ...(opts.includeCost && opts.revealExpected ? { summary: st.status === "APPROVED" ? { ...summary, net: st.varianceTotal } : summary } : {}),
    lines,
  };
}

export async function transition(db: Db, actor: Actor, stocktakeId: string, to: "REVIEW" | "ABANDONED") {
  await db.$transaction(async (tx) => {
    const st = await tx.stocktake.findUnique({ where: { id: stocktakeId } });
    if (!st) throw problem("not-found");
    if (st.status === to) return;
    if (!canTransition(st.status as StocktakeStatus, to)) throw problem("illegal-transition", { status: st.status });
    if (to === "REVIEW" && (await tx.stocktakeLine.count({ where: { stocktakeId, countedQty: { not: null } } })) === 0) {
      throw problem("malformed-request", { reason: "nothing-counted" });
    }
    await tx.stocktake.update({ where: { id: stocktakeId }, data: { status: to, ...(to === "ABANDONED" ? { abandonedAt: clock.iso() } : {}) } });
    await writeAudit(tx, { userId: actor.userId, action: to === "REVIEW" ? "stocktake.review" : "stocktake.abandon", entityType: "Stocktake", entityId: stocktakeId });
  });
}

/** §13.4: approval posts the adjustments and values the shrinkage. It is irreversible except by a further adjustment. */
export async function approveStocktake(db: Db, actor: Actor, stocktakeId: string) {
  await db.$transaction(async (tx) => {
    const current = await tx.stocktake.findUnique({ where: { id: stocktakeId } });
    if (!current) throw problem("not-found");
    if (current.status === "APPROVED") return;
    if (!canTransition(current.status as StocktakeStatus, "APPROVED")) throw problem("illegal-transition", { status: current.status });

    const { st, counted } = await evaluate(tx, stocktakeId);
    const summary = summarize(counted);
    const lineIds = new Map(st.lines.map((l) => [l.productId, l.id]));
    const now = clock.iso();
    for (const c of counted) {
      const v = lineVariance(c);
      if (!v) continue;
      if (v.varianceQty !== 0) {
        // The average at the moment of approval, which a stocktake never moves (§10.4).
        const product = await tx.product.findUniqueOrThrow({ where: { id: c.productId }, select: { avgCostMdram: true } });
        await postMovement(tx, {
          productId: c.productId, type: "STOCKTAKE", qtyDelta: v.varianceQty, unitCostMdram: product.avgCostMdram,
          source: { type: "Stocktake", id: stocktakeId }, userId: actor.userId,
        });
      }
      await tx.stocktakeLine.update({ where: { id: lineIds.get(c.productId)! }, data: { varianceQty: v.varianceQty, varianceValue: v.varianceValue ?? 0 } });
      // The shelf has been counted: the recount it was flagged for has happened (§13.6).
      await tx.reviewFlag.updateMany({ where: { type: "INSUFFICIENT_STOCK", productId: c.productId, resolvedAt: null }, data: { resolvedAt: now, resolvedBy: actor.userId } });
    }
    await tx.stocktake.update({ where: { id: stocktakeId }, data: { status: "APPROVED", approvedAt: now, approvedBy: actor.userId, varianceTotal: summary.net } });
    await writeAudit(tx, {
      userId: actor.userId, action: "stocktake.approve", entityType: "Stocktake", entityId: stocktakeId,
      after: { counted: summary.counted, differing: summary.differing, shortage: summary.shortage, surplus: summary.surplus, net: summary.net, withoutCost: summary.withoutCost },
    });
  });
}

export async function listStocktakes(db: Db) {
  return db.stocktake.findMany({ orderBy: { startedAt: "desc" }, take: 30, include: { _count: { select: { lines: true } } } });
}

export async function openStocktake(db: Db) {
  return db.stocktake.findFirst({ where: { status: { in: OPEN_STATUSES } } });
}
