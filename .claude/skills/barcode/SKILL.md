---
name: barcode
description: Barcode input for Simon — HID keyboard-wedge scanners as the primary path, camera scanning and its secure-context constraint, multi-barcode products, internally generated codes for unbarcoded goods, weight-embedded EAN-13, and checkout input focus management. Use for anything involving scanning, product lookup by code, or the checkout input path.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Barcode input

Scanning is the hottest path in the product. Budget: **scan → line rendered in under 200 ms
(p95)** (PRD §20).

## Support both, HID first

| Path | When | Priority |
|---|---|---|
| **HID keyboard-wedge** (USB/Bluetooth laser) | Fixed till | **Primary** — fastest, no driver, ~15–25k ֏ |
| **Camera** (`html5-qrcode` / `react-zxing`) | Mobile worker, aisle-side | Secondary |

A camera-only POS is an adoption risk: phone cameras are slow and unreliable on worn 1D
labels under shop lighting, and the worker has a queue. Build the HID path first.

## HID scanner

A wedge scanner *is a keyboard*. It types the code fast and presses Enter. There is no API.

```ts
// Detect a scan by input velocity, not by focus.
const SCAN_MAX_GAP_MS = 40;   // human typing is far slower
const SCAN_MIN_LENGTH = 6;

function useScanner(onScan: (code: string) => void) {
  // buffer keydown chars; if gap > SCAN_MAX_GAP_MS reset the buffer;
  // on Enter with buffer.length >= SCAN_MIN_LENGTH -> onScan(buffer)
}
```

Rules:
- Listen at the **document level**, not on a focused input. A worker who taps elsewhere must
  not break scanning.
- **Suppress while a text field is focused** (product search, customer name, quantity), or
  the scan lands in the wrong box.
- Never rely on a hidden always-focused input — mobile keyboards and modals fight it.
- Debounce duplicate scans of the same code within ~300 ms; scanners double-fire.

## Camera

⚠️ **`getUserMedia` requires a secure context.** On a plain-HTTP LAN IP (`http://192.168.1.x`)
Android Chrome and iOS Safari refuse camera access — usually *silently*. This is a known
constraint, not a bug to debug (PRD §17, §15.6).

Resolve one of:
- TLS on the LAN with a certificate trusted on staff devices, **or**
- accept camera scanning is unavailable and ship HID only.

Do not spend time debugging a camera that "doesn't work on the phone" before checking the
origin. Detect and message it explicitly:

```ts
if (!window.isSecureContext) {
  // Armenian message: camera unavailable, use the scanner
}
```

Other camera rules: request the rear camera (`facingMode: "environment"`), release the
stream on unmount (a live camera drains a worker's phone), and always offer manual entry
as a fallback.

## Lookup

Barcode → product is **one-to-many**: a product legitimately carries a manufacturer EAN, an
internal code, and a second supplier's code (PRD §11).

```ts
// ProductBarcode.barcode is UNIQUE and indexed — the hottest query in the system
findProductByBarcode(code): Product | null
```

Resolution order: exact match → normalised match (trim, strip leading zeros, EAN-8↔EAN-13)
→ weight-embedded parse → not found.

### Not found

An unknown barcode is **normal**, not an error — much of a hardware store's stock has no
manufacturer code. Open the 15-second "add product" sheet (name, price, unit) and let the
catalogue fill through trading (PRD §18.1). This is the highest-leverage onboarding feature
in the product; never dead-end on "product not found".

### Internal barcodes

Goods with no code get a generated internal code (Code128) and a printed label. Use a
reserved prefix so internal codes are distinguishable from manufacturer codes. Never reuse
a retired code — historical sale lines reference it.

### Weight-embedded EAN-13

Scale-printed labels encode weight or price in the barcode, typically under a `2x` prefix:

```
2 PPPPP WWWWW C   → prefix, item code, weight/price, check digit
```

The embedded field's meaning (grams vs. price) is **scale-configurable** — read it from
settings, never hardcode. Deferred past v1, but keep the lookup path pluggable.

## Checkout focus

The scan path must survive real use:
- After a scan the input stays ready for the next one — no manual refocus.
- Quantity entry does not steal the scanner (suppress while the keypad is open).
- Scanning an item already in the basket **increments** its quantity; it does not add a
  second line.
- Feedback is immediate and non-visual-only: a short beep plus the line appearing. Workers
  are not looking at the screen while scanning.

## Testing

- Unit: velocity-based scan detection (fast burst = scan, slow typing = not), duplicate
  suppression, EAN-8↔13 normalisation, weight-embedded parse.
- Component: scanning while a text field is focused does not corrupt the field.
- Manual: this is genuinely hardware-dependent — verify with the real scanner model the
  pilot store will use before calling it done.

## Checklist

- [ ] HID path works with no focused input
- [ ] Scanner suppressed while a text field has focus
- [ ] Duplicate scans debounced
- [ ] Secure-context check before offering camera
- [ ] Unknown barcode opens quick-add, never dead-ends
- [ ] Repeat scan increments the existing line
- [ ] Audible feedback on success and on failure
