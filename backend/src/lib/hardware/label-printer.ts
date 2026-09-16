/**
 * The label printer. PRD §18: internal barcodes (Code128) for unbarcoded goods; the sticker is v2.
 *
 * Labels are rendered as ZPL, the language most thermal label printers speak. ConsoleLabelPrinter
 * writes the ZPL to a file (development, and shops printing labels on an office printer from the
 * screen instead); ZplTcpLabelPrinter sends it to a network label printer on TCP 9100.
 *
 * Armenian on the label needs a printer with a Unicode font loaded (`^CI28` selects UTF-8); that is
 * verified against the pilot model, as the receipt printer's code page is (§18).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { formatDram } from "@simon/shared";
import { config } from "../config.ts";

export interface Label {
  name: string;
  priceDram: number;
  unit: string;
  barcode: string;
}

export interface LabelPrinter {
  print(labels: readonly Label[]): Promise<void>;
}

/** A 40 × 30 mm label at 203 dpi: name, price, barcode and its text. */
export function renderZpl(labels: readonly Label[]): string {
  // ZPL treats ^ and ~ as commands; a product name must not be able to issue one.
  const safe = (s: string) => s.replace(/[\^~]/g, " ").slice(0, 60);
  return labels.map((l) => [
    "^XA",
    "^CI28",
    "^PW320",
    "^LL240",
    `^FO12,10^A0N,26,26^FB296,2,0,L^FD${safe(l.name)}^FS`,
    `^FO12,70^A0N,40,40^FD${safe(formatDram(l.priceDram).replace(/ /g, " "))} / ${safe(l.unit)}^FS`,
    `^FO12,120^BY2^BCN,70,Y,N,N^FD${safe(l.barcode)}^FS`,
    "^XZ",
  ].join("\n")).join("\n");
}

export class ConsoleLabelPrinter implements LabelPrinter {
  private readonly dir: string;
  constructor(dir: string) { this.dir = dir; }
  async print(labels: readonly Label[]) {
    mkdirSync(this.dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(path.join(this.dir, `${stamp}-labels.zpl`), renderZpl(labels) + "\n");
  }
}

export class ZplTcpLabelPrinter implements LabelPrinter {
  private readonly host: string;
  private readonly port: number;
  constructor(host: string, port: number) { this.host = host; this.port = port; }
  print(labels: readonly Label[]) {
    const data = Buffer.from(renderZpl(labels), "utf8");
    return new Promise<void>((resolve, reject) => {
      const socket = net.connect({ host: this.host, port: this.port, timeout: 4000 }, () => socket.end(data));
      socket.on("close", (hadError) => (hadError ? reject(new Error("label printer connection failed")) : resolve()));
      socket.on("timeout", () => { socket.destroy(); reject(new Error("label printer timeout")); });
      socket.on("error", reject);
    });
  }
}

let current: LabelPrinter = config.labelPrinter === "zpl-tcp"
  ? new ZplTcpLabelPrinter(config.labelPrinterHost, config.labelPrinterPort)
  : new ConsoleLabelPrinter(config.printDir);

export const labelPrinter = {
  get: () => current,
  set: (p: LabelPrinter) => { current = p; },
  /** Whether a label printer is configured, or labels should be printed from the screen. */
  kind: () => config.labelPrinter,
};
