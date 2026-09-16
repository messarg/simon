// Renders the app icon from frontend/public/favicon.svg at 1024 px, the size macOS icons start from.
// Usage: node scripts/render-icon.mjs <out.png>
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const out = process.argv[2];
if (!out) throw new Error("usage: render-icon.mjs <out.png>");
const svg = readFileSync(path.resolve(import.meta.dirname, "../frontend/public/favicon.svg"), "utf8");
const size = 1024;
// macOS draws icons on a rounded square with a margin; the artwork sits inside it (Apple's grid).
const inset = Math.round(size * 0.1);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: size, height: size } });
await page.setContent(`<body style="margin:0;background:transparent">
  <div style="position:absolute;inset:${inset}px;border-radius:${Math.round(size * 0.18)}px;overflow:hidden;box-shadow:0 ${size * 0.01}px ${size * 0.03}px rgba(0,0,0,.25)">
    ${svg.replace("<svg", '<svg width="100%" height="100%" preserveAspectRatio="none"')}
  </div></body>`);
await page.screenshot({ path: out, omitBackground: true });
await browser.close();
