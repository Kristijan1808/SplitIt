import type { Request, Response, NextFunction } from "express";
import { chatGptService } from "../chatgpt.service.js";

export class BillService {
  parseBill = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.file) {
        res.status(400).json({
          error: "Bill image is required"
        });
        return;
      }

      const items = await chatGptService.extractBillItems(
        req.file.buffer,
        req.file.mimetype,
        Number(req.body?.attempt) === 2 ? 2 : 1
      );

      res.json({ items });
    } catch (error) {
      next(error);
    }
  };
}

export const billService = new BillService();
