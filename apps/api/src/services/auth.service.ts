import type { Request, Response, NextFunction } from "express";
import {
  createToken,
  getUserFromRequest,
  normalizeUsername,
  prisma
} from "../core.js";
import * as schemas from "../schemas/schemas.js";
import bcrypt from "bcryptjs";

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
            "Username or email already exists"
        });
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
        await prisma.user.findUnique({
          where: { username }
        });

      if (!user) {
        return res.status(401).json({
          error:
            "Invalid username/email or password"
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
            "Invalid username/email or password"
        });
      }

      res.json({
        token: createToken({
          id: user.id,
          username: user.username
        }),

        user: {
          id: user.id,
          username: user.username
        }
      });
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

    return res.json({ user });
  };

  logout = async (
    _req: Request,
    res: Response
  ) => res.json({ ok: true });
}

export const authService = new AuthService();
