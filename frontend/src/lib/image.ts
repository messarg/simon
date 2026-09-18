/**
 * The photograph is downscaled on the device before it is uploaded (§6.11.1, §11 `User.avatar`).
 *
 * A phone camera writes four megabytes for a face that is drawn at 56 px on a sign-in tile, and
 * the row it lands in is the only binary column in a database that §19.2 backs up whole. So the
 * picture is cover-cropped to a square, redrawn at 256 px, and re-encoded as JPEG at falling
 * quality until it fits the server's limit — the client sends nothing the server would refuse.
 */

/** Both sides of the wire agree on this: §11 bounds the column, this bounds the upload. */
export const MAX_AVATAR_BYTES = 64 * 1024;

const SIZE = 256;
const QUALITIES = [0.82, 0.72, 0.62, 0.52, 0.42, 0.32, 0.24];

export type AvatarError = "image-unreadable" | "image-too-large";

/** Decoded bytes behind a `data:` URL, without decoding it. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through: some browsers cannot decode every format this way.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image-unreadable"));
      img.src = url;
    });
  } finally {
    // Revoked after the promise settles; the bitmap is already drawn from by then.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/**
 * A square JPEG data URL of at most {@link MAX_AVATAR_BYTES}, or one of {@link AvatarError}.
 */
export async function squareAvatarDataUrl(file: File): Promise<string> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(file);
  } catch {
    throw new Error("image-unreadable" satisfies AvatarError);
  }
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("image-unreadable" satisfies AvatarError);

  // Cover-crop from the middle: a portrait's subject is in the centre, and letterboxing a face
  // into a square tile wastes the half of the tile that makes it recognisable at a glance.
  const side = Math.min(source.width, source.height);
  ctx.drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  if ("close" in source) source.close();

  for (const quality of QUALITIES) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (dataUrlBytes(url) <= MAX_AVATAR_BYTES) return url;
  }
  throw new Error("image-too-large" satisfies AvatarError);
}
