import {z} from "zod";
// Small avatar images are stored as data URLs. The clients resize them to about
// 256 px first; the limit keeps group snapshots and /auth/me lightweight.
export const MAX_AVATAR_CHARS = 70_000;
export const imageDataUrl = z
  .string()
  .max(MAX_AVATAR_CHARS, "Slika je prevelika.")
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/, "Dopuštene su PNG, JPEG ili WebP slike.");
