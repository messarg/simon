/**
 * The printer and cash drawer, owned by the host. PRD §18.
 *
 * Printing and the kick-out pulse are separate commands on purpose: a reprint must never open
 * the drawer. Failures are reported and never retried by a timer — the person holding the
 * paper decides whether to call the route again.
 *
 * ConsolePrinter writes receipts to files (development, and shops that have no printer yet).
 * EscPosTcpPrinter talks to a network thermal printer on TCP 9100. Armenian glyphs need a
 * raster or a printer with an Armenian code page; that is verified against the pilot model.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { config } from "../config.ts";

export interface Printer {
  print(title: string, lines: readonly string[]): Promise<void>;
  kick(): Promise<void>;
}

export class ConsolePrinter implements Printer {
  private readonly dir: string;
  constructor(dir: string) { this.dir = dir; }
  async print(title: string, lines: readonly string[]) {
    mkdirSync(this.dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(path.join(this.dir, `${stamp}-${title.replace(/[^\w-]/g, "_")}.txt`), lines.join("\n") + "\n");
  }
  async kick() {
    mkdirSync(this.dir, { recursive: true });
    appendFileSync(path.join(this.dir, "drawer.log"), `${new Date().toISOString()} kick\n`);
  }
}

const ESC = 0x1b;
const GS = 0x1d;

export class EscPosTcpPrinter implements Printer {
  private readonly host: string;
  private readonly port: number;
  constructor(host: string, port: number) { this.host = host; this.port = port; }
  private send(data: Buffer) {
    return new Promise<void>((resolve, reject) => {
      const socket = net.connect({ host: this.host, port: this.port, timeout: 4000 }, () => socket.end(data));
      socket.on("close", (hadError) => (hadError ? reject(new Error("printer connection failed")) : resolve()));
      socket.on("timeout", () => { socket.destroy(); reject(new Error("printer timeout")); });
      socket.on("error", reject);
    });
  }
  print(_title: string, lines: readonly string[]) {
    return this.send(Buffer.concat([Buffer.from([ESC, 0x40]), Buffer.from(lines.join("\n") + "\n\n\n", "utf8"), Buffer.from([GS, 0x56, 0x00])]));
  }
  kick() {
    return this.send(Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]));
  }
}

let current: Printer = config.printer === "escpos-tcp" ? new EscPosTcpPrinter(config.printerHost, config.printerPort) : new ConsolePrinter(config.printDir);

export const printer = {
  get: () => current,
  /** Tests swap in a recording or failing printer. */
  set: (p: Printer) => { current = p; },
};
