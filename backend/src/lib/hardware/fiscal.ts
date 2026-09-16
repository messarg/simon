/**
 * The fiscal adapter. PRD §17: `Sale.fiscalReceiptId` is reserved for it, and v1 ran without one.
 *
 * This is the seam, not a driver. Whether a shop must issue fiscal receipts, which devices are
 * certified, and whether a third-party POS may drive one are §26 Q1 and §17's open questions, and
 * a real ՀԴՄ driver is written against the device and the answers. What is settled here is the
 * shape every driver will have to fit: one call per completed sale, after it commits, returning
 * the device's receipt number — and a failure that never un-sells anything.
 *
 * `none` issues nothing and is the default. `file` writes each fiscal document as JSON and returns
 * a sequential development number, so the checkout path can be exercised end to end.
 */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config } from "../config.ts";

export interface FiscalLine { name: string; qty: number; uom: string; unitPriceMdram: number; lineTotal: number; taxRateBp: number; lineTax: number }
export interface FiscalDocument {
  saleId: string;
  number: string | null;
  completedAt: string;
  priceBasis: string;
  lines: FiscalLine[];
  discountTotal: number;
  taxTotal: number;
  total: number;
  payments: Array<{ method: string; amount: number }>;
}

export interface FiscalDevice {
  readonly enabled: boolean;
  issue(doc: FiscalDocument): Promise<{ receiptId: string }>;
}

export class NoFiscalDevice implements FiscalDevice {
  readonly enabled = false;
  async issue(): Promise<{ receiptId: string }> {
    throw new Error("no fiscal device configured");
  }
}

export class FileFiscalDevice implements FiscalDevice {
  readonly enabled = true;
  private readonly dir: string;
  constructor(dir: string) { this.dir = dir; }
  async issue(doc: FiscalDocument) {
    mkdirSync(this.dir, { recursive: true });
    const n = readdirSync(this.dir).filter((f) => f.endsWith(".json")).length + 1;
    const receiptId = `DEV-${String(n).padStart(6, "0")}`;
    writeFileSync(path.join(this.dir, `${receiptId}.json`), JSON.stringify({ receiptId, ...doc }, null, 2));
    return { receiptId };
  }
}

let current: FiscalDevice = config.fiscal === "file" ? new FileFiscalDevice(path.join(config.printDir, "fiscal")) : new NoFiscalDevice();

export const fiscal = {
  get: () => current,
  set: (d: FiscalDevice) => { current = d; },
};
