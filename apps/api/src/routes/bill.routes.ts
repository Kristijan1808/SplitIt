import { Router } from "express";
import multer from "multer";
import { billService } from "../services/bill.service.js";

export const billRouter = Router();
// Validate the actual bytes in the service: device MIME labels can be missing.
const billImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 2, fieldSize: 1024 },
});
billRouter.post("/parse-bill", billImageUpload.single("file"), billService.parseBill);
