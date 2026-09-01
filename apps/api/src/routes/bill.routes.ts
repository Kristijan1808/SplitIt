import { Router } from "express";
import multer, { type FileFilterCallback } from "multer";
import type { Request } from "express";
import { billService } from "../services/bill.service.js";

export const billRouter = Router();

const billImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, callback: FileFilterCallback) => {
    const allowed = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif"
    ]);

    if (!allowed.has(file.mimetype)) {
      callback(
        new Error(
          "Unsupported image type. Please upload a JPEG, PNG, WebP, or GIF image"
        )
      );
      return;
    }

    callback(null, true);
  }
});

billRouter.post(
  "/parse-bill",
  billImageUpload.single("file"),
  billService.parseBill
);
