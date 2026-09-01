import type { Request, Response } from "express";
import { prisma } from "../core.js";

export class HealthService {
  health = (
    _req: Request,
    res: Response
  ) => {
    res.json({
      ok: true,
      app: "SplitIt API",
      version: "1.0.0"
    });
  };

  dbHealth = async (
    _req: Request,
    res: Response
  ) => {
    try {
      const total = await prisma.group.count();

      res.json({
        ok: true,
        app: "SplitIt DB",
        database: "connected",
        stats: { groups: total }
      });
    } catch (error) {
      console.error("Database connection error:", error);

      res.status(500).json({
        ok: false,
        app: "SplitIt API",
        error: "Database connection failed"
      });
    }
  };
}

export const healthService = new HealthService();
