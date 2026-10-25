import { Router } from "express";
import { authService } from "../services/auth.service.js";
import { joinLimit } from "../services/rate-limit.js";

export const authRouter = Router();

authRouter.post("/register", joinLimit, authService.register);
authRouter.post("/login", joinLimit, authService.login);
authRouter.post("/google", joinLimit, authService.google);
authRouter.get("/me", authService.me);
authRouter.post("/logout", authService.logout);
