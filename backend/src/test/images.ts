/**
 * Minimal but genuine PNG and JPEG headers, built byte by byte.
 *
 * The host reads a photograph's size out of the file itself (§11 `User.avatar`), so a test fixture
 * has to be a real header rather than random bytes with the right first four.
 */

/** 8-byte signature, then the IHDR chunk the width and height live in. */
export function pngBytes(width = 128, height = 128, padTo = 0): Buffer {
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write("IHDR", 4, "ascii");
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8; // bit depth
  ihdr[17] = 6; // colour type: RGBA
  const head = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ihdr]);
  return padTo > head.length ? Buffer.concat([head, Buffer.alloc(padTo - head.length, 0x20)]) : head;
}

/** SOI, an APP0 segment to be walked past, then the SOF0 frame carrying the dimensions. */
export function jpegBytes(width = 128, height = 128, padTo = 0): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const sof0 = Buffer.alloc(11);
  sof0.writeUInt16BE(0xffc0, 0);
  sof0.writeUInt16BE(11, 2);
  sof0[4] = 8; // sample precision
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  const head = Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof0]);
  return padTo > head.length ? Buffer.concat([head, Buffer.alloc(padTo - head.length, 0x20)]) : head;
}

export const dataUrl = (mediaType: string, bytes: Buffer) => `data:${mediaType};base64,${bytes.toString("base64")}`;
