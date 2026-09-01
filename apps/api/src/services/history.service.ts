import type { NextFunction, Request, Response } from "express";
import {
  prisma
} from "../core.js";
import { ensureCanViewGroup } from "./access.service.js";

export class HistoryService {


  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const group =
        await prisma.group.findUnique({
          where: {
            slug: req.params.slug as string
          },

          include: {
            history: {
              orderBy: {
                createdAt: "desc"
              }
            }
          }
        });

      if (!group) {
        return res.status(404).json({
          error: "Group not found"
        });
      }

      const access =
        await ensureCanViewGroup(
          group,
          req
        );

      if (!access.allowed) {
        return res
          .status(access.status)
          .json({
            error: access.error
          });
      }

      res.json(
        group.history
      );
    } catch (error) {
      next(error);
    }
  
  };

}

export const historyService = new HistoryService();
