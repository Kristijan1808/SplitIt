import type { Request, Response, NextFunction } from "express";
import { billImage } from "./bill-image.js";
import { chatGptService } from "../chatgpt.service.js";

export class BillService {
  parseBill = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const image = billImage(req.file, req.body?.imageBase64);

      const items = await chatGptService.extractBillItems(
        image.buffer,
        image.mimeType,
        Number(req.body?.attempt) === 2 ? 2 : 1
      );

      res.json({ items });
    } catch (error) {
      next(error);
    }
  };
}

export const billService = new BillService();
