/** §6.11.1, §11 `User.avatar` — the bound the host re-checks, because the column is served before authentication. */
import { describe, expect, it } from "vitest";
import { dataUrl, jpegBytes, pngBytes } from "../test/images.ts";
import { AVATAR_MAX_BYTES, decodeAvatar } from "./avatar.ts";

describe("staff photograph validation", () => {
  it("accepts a bounded PNG and a bounded JPEG, reading the size out of the file itself", () => {
    expect(decodeAvatar(dataUrl("image/png", pngBytes(256, 256)))).toMatchObject({ ok: true, mediaType: "image/png", width: 256, height: 256 });
    expect(decodeAvatar(dataUrl("image/jpeg", jpegBytes(64, 64)))).toMatchObject({ ok: true, mediaType: "image/jpeg", width: 64, height: 64 });
  });

  it("refuses a PNG declared as a JPEG — the label is not evidence", () => {
    expect(decodeAvatar(dataUrl("image/jpeg", pngBytes()))).toEqual({ ok: false, reason: "magic-mismatch" });
    expect(decodeAvatar(dataUrl("image/png", jpegBytes()))).toEqual({ ok: false, reason: "magic-mismatch" });
  });

  it("refuses everything that is not one of the two media types, however it is dressed", () => {
    expect(decodeAvatar(dataUrl("image/svg+xml", pngBytes()))).toEqual({ ok: false, reason: "unsupported-media-type" });
    expect(decodeAvatar(dataUrl("image/gif", pngBytes()))).toEqual({ ok: false, reason: "unsupported-media-type" });
    expect(decodeAvatar("https://example.invalid/face.png")).toEqual({ ok: false, reason: "not-a-data-url" });
    expect(decodeAvatar("data:image/png;base64,")).toEqual({ ok: false, reason: "not-a-data-url" });
    expect(decodeAvatar("data:image/png;base64,not base64 at all!")).toEqual({ ok: false, reason: "not-a-data-url" });
  });

  it("refuses more than 64 KB decoded, and more than 256 pixels on an edge", () => {
    expect(decodeAvatar(dataUrl("image/png", pngBytes(128, 128, AVATAR_MAX_BYTES + 1)))).toEqual({ ok: false, reason: "too-large" });
    expect(decodeAvatar(dataUrl("image/png", pngBytes(128, 128, AVATAR_MAX_BYTES)))).toMatchObject({ ok: true });
    expect(decodeAvatar(dataUrl("image/png", pngBytes(257, 256)))).toEqual({ ok: false, reason: "too-many-pixels" });
    expect(decodeAvatar(dataUrl("image/jpeg", jpegBytes(300, 300)))).toEqual({ ok: false, reason: "too-many-pixels" });
  });

  it("refuses a file whose header says nothing — magic bytes alone are not a picture", () => {
    const truncated = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(decodeAvatar(dataUrl("image/png", truncated))).toEqual({ ok: false, reason: "unreadable-header" });
    expect(decodeAvatar(dataUrl("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xd9])))).toEqual({ ok: false, reason: "unreadable-header" });
    expect(decodeAvatar(dataUrl("image/png", pngBytes(0, 0)))).toEqual({ ok: false, reason: "unreadable-header" });
  });
});
