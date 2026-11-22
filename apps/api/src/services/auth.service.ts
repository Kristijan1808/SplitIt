import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import {
  createToken,
  getUserFromRequest,
  normalizeUsername,
  prisma
} from "../core.js";
import * as schemas from "../schemas/schemas.js";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { imageDataUrl } from "./image-data-url.js";

const googleAuthClient = new OAuth2Client();

export class AuthService {
  register = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const body =
        schemas.registerSchema.parse(req.body);

      if (
        body.password !==
        body.repeatPassword
      ) {
        return res.status(400).json({
          error:
            "Passwords do not match"
        });
      }

      const username =
        normalizeUsername(
          body.username
        );

      const existingUser =
        await prisma.user.findUnique({
          where: { username }
        });

      if (existingUser) {
        return res.status(409).json({
          error:
            "Username already exists"
        });
      }

      // E-mail ne smije biti zauzet ni kao e-mail ni kao korisničko ime (Google računi koriste e-mail kao ime).
      const emailTaken = await prisma.user.findFirst({
        where: { OR: [{ email: body.email }, { username: body.email }] },
        select: { id: true }
      });
      if (emailTaken) {
        return res.status(409).json({ error: "Email already exists" });
      }

      const passwordHash =
        await bcrypt.hash(
          body.password,
          12
        );

      const user =
        await prisma.user.create({
          data: {
            username,
            email: body.email,
            passwordHash
          },

          select: {
            id: true,
            username: true
          }
        });

      res.status(201).json({
        token: createToken(user),
        user
      });
    } catch (error) {
      next(error);
    }
  
  };

  login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const body =
        schemas.authSchema.parse(req.body);

      const username =
        normalizeUsername(
          body.username
        );

      const user =
        (await prisma.user.findUnique({
          where: { username }
        })) ??
        (username.includes("@")
          ? await prisma.user.findUnique({ where: { email: username } })
          : null);

      if (!user) {
        return res.status(401).json({
          error:
            "Invalid username or password"
        });
      }

      const validPassword =
        await bcrypt.compare(
          body.password,
          user.passwordHash
        );

      if (!validPassword) {
        return res.status(401).json({
          error:
            "Invalid username or password"
        });
      }

      res.json({
        token: createToken({
          id: user.id,
          username: user.username
        }),

        user: {
          id: user.id,
          username: user.username,
          avatarImage: user.avatarImage ?? null
        }
      });
    } catch (error) {
      next(error);
    }
  
  };

  google = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { credential } = schemas.googleAuthSchema.parse(req.body);
      const clientId = process.env.GOOGLE_CLIENT_ID;

      if (!clientId) {
        return res.status(503).json({
          error: "Google sign-in is not configured"
        });
      }

      let payload;
      try {
        const ticket = await googleAuthClient.verifyIdToken({
          idToken: credential,
          audience: clientId
        });
        payload = ticket.getPayload();
      } catch {
        return res.status(401).json({
          error: "Invalid Google credential"
        });
      }

      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        return res.status(401).json({
          error: "A verified Google email is required"
        });
      }

      const user = await prisma.user.findUnique({
        where: { googleSubject: payload.sub },
        select: { id: true, username: true, avatarImage: true }
      });

      if (user) {
        return res.json({ token: createToken(user), user });
      }

      const username = normalizeUsername(payload.email);
      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ username }, { email: username }] },
        select: { id: true }
      });

      if (existingUser) {
        return res.status(409).json({
          error: "An account with this email already exists. Sign in with that account."
        });
      }

      const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
      let newUser: { id: string; username: string };
      try {
        newUser = await prisma.user.create({
          data: {
            username,
            email: username,
            passwordHash,
            googleSubject: payload.sub
          },
          select: { id: true, username: true }
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const racedUser = await prisma.user.findUnique({
            where: { googleSubject: payload.sub },
            select: { id: true, username: true, avatarImage: true }
          });
          if (racedUser) {
            return res.json({
              token: createToken(racedUser),
              user: racedUser
            });
          }
          return res.status(409).json({
            error: "An account with this email already exists. Sign in with that account."
          });
        }
        throw error;
      }

      return res.json({ token: createToken(newUser), user: newUser });
    } catch (error) {
      next(error);
    }
  };

  me = async (
    req: Request,
    res: Response
  ) => {
    const user = getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({
        error: "Not logged in"
      });
    }

    const stored = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, username: true, avatarImage: true }
    });

    return res.json({ user: stored ?? user });
  };

  setAvatar = async (
    req: Request,
    res: Response
  ) => {
    const user = getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({
        error: "Not logged in"
      });
    }

    const parsed = z
      .object({ image: imageDataUrl.nullable() })
      .strict()
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Neispravna slika."
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { avatarImage: parsed.data.image }
    });

    return res.json({ ok: true });
  };

  logout = async (
    _req: Request,
    res: Response
  ) => res.json({ ok: true });
}

export const authService = new AuthService();
