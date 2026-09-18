/**
 * The staff photograph, validated. PRD §6.11.1, §11 (`User.avatar`), §19.6.
 *
 * Pure: a data URL in, bytes and a media type out, no I/O and no Prisma. The bound matters more
 * here than anywhere else in the schema because the column is served to an unauthenticated caller
 * (§15.4, §26.2) — "a column whose bound is enforced where the caller cannot reach". The device
 * downscales before upload; this is the re-check, and it trusts none of it:
 *
 * - the declared media type must be exactly PNG or JPEG, and the **magic bytes must agree with it**,
 *   so a renamed executable or an SVG cannot enter the database behind an `image/png` label;
 * - the decoded payload must be at most 64 KB;
 * - the picture must be at most 256 × 256, read out of the file's own header rather than believed.
 */

export const AVATAR_MAX_BYTES = 64 * 1024;
export const AVATAR_MAX_EDGE = 256;
/** Base64 grows by 4/3; the header is short. This caps work before any decoding happens. */
export const AVATAR_MAX_DATA_URL = 4 + Math.ceil((AVATAR_MAX_BYTES * 4) / 3) + 64;

export type AvatarMediaType = "image/png" | "image/jpeg";

export type AvatarReject =
  | "not-a-data-url"
  | "unsupported-media-type"
  | "malformed-base64"
  | "empty"
  | "too-large"
  | "magic-mismatch"
  | "unreadable-header"
  | "too-many-pixels";

export type AvatarDecoded = { ok: true; bytes: Uint8Array; mediaType: AvatarMediaType; width: number; height: number };
export type AvatarRejected = { ok: false; reason: AvatarReject };

const DATA_URL = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;
const MEDIA_TYPES: readonly string[] = ["image/png", "image/jpeg"];

/** `89 50 4E 47` and `FF D8 FF` — the two files this system accepts, recognised by their own first bytes. */
const MAGIC: Record<AvatarMediaType, readonly number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
};

const startsWith = (bytes: Uint8Array, magic: readonly number[]) =>
  bytes.length >= magic.length && magic.every((b, i) => bytes[i] === b);

const u16 = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];
const u32 = (b: Uint8Array, at: number) => ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];

/** IHDR is the first chunk and always at offset 8: length, type, then width and height. */
function pngSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 24) return null;
  if (String.fromCharCode(b[12], b[13], b[14], b[15]) !== "IHDR") return null;
  return { width: u32(b, 16), height: u32(b, 20) };
}

/** Walk the segment chain to the first start-of-frame; DHT, DAC and RST are not frames. */
function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let at = 2;
  while (at + 9 < b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
    if (marker === 0xff) { at += 1; continue; }
    const length = u16(b, at + 2);
    if (length < 2) return null;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) return { height: u16(b, at + 5), width: u16(b, at + 7) };
    at += 2 + length;
  }
  return null;
}

export function decodeAvatar(dataUrl: string): AvatarDecoded | AvatarRejected {
  if (dataUrl.length > AVATAR_MAX_DATA_URL) return { ok: false, reason: "too-large" };
  const match = DATA_URL.exec(dataUrl.trim());
  if (!match) return { ok: false, reason: "not-a-data-url" };
  const [, declared, base64] = match;
  if (!MEDIA_TYPES.includes(declared)) return { ok: false, reason: "unsupported-media-type" };
  const mediaType = declared as AvatarMediaType;

  const bytes = new Uint8Array(Buffer.from(base64, "base64"));
  // Buffer.from is lenient; a payload that does not survive the round trip was never base64.
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  if (Buffer.from(bytes).toString("base64").replace(/=+$/, "") !== base64.replace(/=+$/, "")) return { ok: false, reason: "malformed-base64" };
  if (bytes.length > AVATAR_MAX_BYTES) return { ok: false, reason: "too-large" };
  if (!startsWith(bytes, MAGIC[mediaType])) return { ok: false, reason: "magic-mismatch" };

  const size = mediaType === "image/png" ? pngSize(bytes) : jpegSize(bytes);
  if (!size || size.width < 1 || size.height < 1) return { ok: false, reason: "unreadable-header" };
  if (size.width > AVATAR_MAX_EDGE || size.height > AVATAR_MAX_EDGE) return { ok: false, reason: "too-many-pixels" };

  return { ok: true, bytes, mediaType, width: size.width, height: size.height };
}
