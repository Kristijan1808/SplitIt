import type { ErrorRequestHandler } from "express";
import { MulterError } from "multer";
import { z } from "zod";

export const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next
) => {
  console.error("API ERROR:", error);

  if (error instanceof MulterError) {
    res.status(400).json({
      error:
        error.code === "LIMIT_FILE_SIZE"
          ? "The uploaded image is too large. Maximum size is 10 MB"
          : error.message
    });
    return;
  }

  if (error instanceof z.ZodError) {
    res.status(400).json({
      error: "Validation error",
      details: error.flatten()
    });
    return;
  }

  if (
    error instanceof Error &&
    (
      error.message.startsWith("Unsupported image type") ||
      error.message.startsWith("The uploaded image is too large") ||
      error.message === "The uploaded image is empty"
    )
  ) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(500).json({
    error: "Internal server error",
    message: error instanceof Error ? error.message : String(error)
  });
};
