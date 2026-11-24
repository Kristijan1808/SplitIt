import type { ErrorRequestHandler } from "express";
import { MulterError } from "multer";
import { z } from "zod";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error("API ERROR:", error);
  if (error && [400, 401, 403, 404, 409, 413, 423, 503].includes(error.status)) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  if (error && ["P2002","P2034"].includes(error.code)) {res.status(409).json({error:"Podatak je upravo promijenjen. Osvježi i ponovi radnju; spremljeni račun neće se udvostručiti."});return;}
  if (error instanceof MulterError) {
    res.status(400).json({
      error:
        error.code === "LIMIT_FILE_SIZE"
          ? "The uploaded image is too large. Maximum size is 10 MB"
          : error.message,
    });
    return;
  }

  if (error instanceof z.ZodError) {
    const fields: Record<string, string> = { currency: "valuta", avatar: "oznaka/slika grupe", archived: "arhiviranje", password: "lozinka", locked: "zaključavanje", name: "naziv", role: "uloga", email: "e-pošta", username: "korisničko ime" };
    const reasons = error.issues.map((issue) => {
      const key = String(issue.path[0] ?? "");
      const where = key ? (fields[key] ?? key) + ": " : "";
      const custom = issue.code === "custom" || /[čćžšđ]|Slika|Dopuštene/.test(issue.message);
      const why = custom ? issue.message
        : issue.code === "unrecognized_keys" ? "nepoznato polje (" + (issue as { keys?: string[] }).keys?.join(", ") + ")"
        : issue.code === "too_small" ? "prekratko ili premalo"
        : issue.code === "too_big" ? "predugo ili preveliko"
        : issue.code === "invalid_type" ? "nedostaje ili je pogrešnog tipa"
        : issue.code === "invalid_enum_value" ? "vrijednost nije dopuštena"
        : issue.code === "invalid_string" ? "neispravan format"
        : issue.message;
      return where + why;
    });
    res.status(400).json({
      error: "Neispravni podaci — " + reasons.join("; "),
      details: error.flatten(),
    });
    return;
  }

  if (
    error instanceof Error &&
    (error.message.startsWith("Unsupported image type") ||
      error.message.startsWith("The uploaded image is too large") ||
      error.message === "The uploaded image is empty")
  ) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(500).json({
    error: "Internal server error",
    message: error instanceof Error ? error.message : String(error),
  });
};
