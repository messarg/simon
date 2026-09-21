// Renders every app icon from frontend/public/favicon.svg, which is the only place the mark is drawn.
//
//   node scripts/render-icon.mjs <out.png>   the macOS icon at 1024 px (what build-macos.sh calls)
//   node scripts/render-icon.mjs --web       the PWA icons, back into frontend/public/
//
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const PUBLIC = path.resolve(import.meta.dirname, "../frontend/public");
const svg = readFileSync(path.join(PUBLIC, "favicon.svg"), "utf8");
const sized = (w, h) => svg.replace("<svg", `<svg width="${w}" height="${h}" preserveAspectRatio="none"`);

const browser = await chromium.launch();

async function shoot(out, size, body) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:transparent">${body}</body>`);
  await page.screenshot({ path: out, omitBackground: true });
  await page.close();
}

if (process.argv[2] === "--web") {
  // The PWA icons are the artwork full-bleed: the rounded corners are the mark's own.
  for (const size of [192, 512]) {
    await shoot(path.join(PUBLIC, `icon-${size}.png`), size, sized("100%", "100%"));
  }
  // A maskable icon is cropped to whatever shape the launcher likes, so the teal runs to every edge
  // and the mark sits inside the safe zone — the middle 80% (W3C app manifest, `purpose: maskable`).
  await shoot(path.join(PUBLIC, "icon-maskable-512.png"), 512, `
    <div style="position:absolute;inset:0;background:#14544a"></div>
    <div style="position:absolute;inset:12%">${sized("100%", "100%")}</div>`);
  console.log("wrote icon-192.png, icon-512.png, icon-maskable-512.png");
} else {
  const out = process.argv[2];
  if (!out) throw new Error("usage: render-icon.mjs <out.png> | --web");
  // macOS draws icons on a rounded square with a margin; the artwork sits inside it (Apple's grid).
  const size = 1024;
  const inset = Math.round(size * 0.1);
  await shoot(out, size, `
    <div style="position:absolute;inset:${inset}px;border-radius:${Math.round(size * 0.18)}px;overflow:hidden;box-shadow:0 ${size * 0.01}px ${size * 0.03}px rgba(0,0,0,.25)">
      ${sized("100%", "100%")}
    </div>`);
}

await browser.close();
