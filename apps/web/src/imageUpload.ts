// Crops the picked file to a centred square, scales it down and returns a JPEG data URL
// small enough for the API (limit 70 000 characters).
export async function fileToAvatarDataUrl(file: File, size = 256): Promise<string> {
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) throw new Error("Odaberi PNG, JPEG ili WebP sliku.");
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Slika se nije mogla pripremiti.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= 68_000) return url;
  }
  throw new Error("Slika je prevelika. Odaberi manju sliku.");
}
