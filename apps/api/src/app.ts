import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.routes.js";
import { groupRouter } from "./routes/group.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { billRouter } from "./routes/bill.routes.js";
import { errorHandler } from "./middleware.error.js";

const app = express();

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";

const allowedOrigins = [
  "*",
  "http://localhost:5173",
  WEB_ORIGIN
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json());

app.use("/ai", billRouter);
app.use("/", healthRouter);
app.use("/auth", authRouter);
app.use("/groups", groupRouter);

app.use(errorHandler);

export default app;
