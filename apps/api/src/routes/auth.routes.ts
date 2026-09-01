import { Router } from "express";
import { authService } from "../services/auth.service.js";

export const authRouter = Router();

authRouter.post("/register", authService.register);
authRouter.post("/login", authService.login);
authRouter.get("/me", authService.me);
authRouter.post("/logout", authService.logout);
