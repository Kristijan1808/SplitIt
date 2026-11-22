const MAX_BYTES = 10 * 1024 * 1024;
function invalid(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
export function billImage(file: { buffer: Buffer } | undefined, encoded: unknown) {
  let buffer: Buffer;
  if (file) buffer = file.buffer;
  else {
    if (typeof encoded !== "string" || !encoded.length)
      return invalid("Bill image is required");
    if (encoded.length > 4 * Math.ceil(MAX_BYTES / 3))
      return invalid("Slika je prevelika. Najveća veličina je 10 MB.", 413);
    // Strict canonical base64, not a file URI, object string or data-URL.
    if (encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
      return invalid("Neispravni podaci slike. Ponovno odaberi fotografiju.");
    buffer = Buffer.from(encoded, "base64");
    if (buffer.toString("base64") !== encoded)
      return invalid("Neispravni podaci slike. Ponovno odaberi fotografiju.");
  }
  if (!buffer.length) return invalid("The uploaded image is empty");
  if (buffer.length > MAX_BYTES) return invalid("Slika je prevelika. Najveća veličina je 10 MB.", 413);
  let mimeType: string;
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) mimeType = "image/jpeg";
  else if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) mimeType = "image/png";
  else if (["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))) mimeType = "image/gif";
  else if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") mimeType = "image/webp";
  else return invalid("Format slike nije podržan. Odaberi JPEG, PNG, WebP ili GIF. HEIC fotografiju najprije pretvori u JPEG.");
  return { buffer, mimeType };
}
