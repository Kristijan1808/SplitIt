import { Router } from "express";
import { healthService } from "../services/health.service.js";

export const healthRouter = Router();

healthRouter.get("/health", healthService.health);
healthRouter.get("/db/health", healthService.dbHealth);
