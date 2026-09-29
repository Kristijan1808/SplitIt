import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.routes.js";
import { groupRouter } from "./routes/group.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { billRouter } from "./routes/bill.routes.js";
import { errorHandler } from "./middleware.error.js";

import { billPermissions, guestSession } from "./services/bill-permissions.js";
const app = express();

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";

const allowedOrigins = [
  "http://localhost:8081",
  "https://split-it-web-three.vercel.app",
  "http://localhost:5173",
  WEB_ORIGIN,
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-SplitIt-Participant-Id",
      "X-SplitIt-Guest-Token",
    ],
  }),
);

// Base64 adds approximately one third to the binary image size. Only this route
// accepts a larger JSON body; all other routes retain the default limit.
app.use("/ai/parse-bill", express.json({ limit: "14mb" }));
app.use(express.json());
app.post("/guest-session", guestSession);
app.use(billPermissions);

app.use("/ai", billRouter);
app.use("/", healthRouter);
app.use("/auth", authRouter);
app.use("/groups", groupRouter);

app.use(errorHandler);

export default app;
