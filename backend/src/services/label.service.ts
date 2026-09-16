/**
 * Shelf labels. PRD §18: internal Code128 barcodes for goods that arrive without one; printing the
 * sticker is v2. A product with no barcode at all is given an internal one on the way, because a
 * label without a code is a price tag nobody can scan.
 */
import { uuidv7 } from "@simon/shared";
import type { Db } from "../lib/db.ts";
import { labelPrinter, type Label } from "../lib/hardware/label-printer.ts";
import { problem } from "../lib/problem.ts";
import { clock } from "../lib/time.ts";
import { nextInternalBarcode } from "./product.service.ts";

export async function labelsFor(db: Db, productIds: readonly string[]) {
  const ids = [...new Set(productIds)];
  await db.$transaction(async (tx) => {
    const bare = await tx.product.findMany({ where: { id: { in: ids }, barcodes: { none: { retiredAt: null } } }, select: { id: true } });
    for (const p of bare) {
      await tx.productBarcode.create({ data: { id: uuidv7(), productId: p.id, barcode: await nextInternalBarcode(tx), isPrimary: 1, updatedAt: clock.iso() } });
      await tx.product.update({ where: { id: p.id }, data: { updatedAt: clock.iso() } });
    }
  });
  const products = await db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, sellPriceMdram: true, stockUom: true, barcodes: { where: { retiredAt: null }, orderBy: [{ isPrimary: "desc" }, { updatedAt: "asc" }] } },
  });
  if (products.length !== ids.length) throw problem("not-found", { entity: "Product" });
  return new Map(products.map((p) => [p.id, {
    productId: p.id, name: p.name, priceDram: Math.round(p.sellPriceMdram / 1000), unit: p.stockUom, barcode: p.barcodes[0].barcode,
  }]));
}

export async function printLabels(db: Db, items: ReadonlyArray<{ productId: string; copies: number }>) {
  const labels = await labelsFor(db, items.map((i) => i.productId));
  const sheet: Label[] = items.flatMap((i) => Array.from({ length: i.copies }, () => labels.get(i.productId)!));
  try {
    await labelPrinter.get().print(sheet);
  } catch {
    throw problem("internal-error", { component: "label-printer" });
  }
  return { printed: sheet.length };
}
