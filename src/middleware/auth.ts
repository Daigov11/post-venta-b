import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

declare module "express-serve-static-core" {
  interface Request {
    externalToken?: string;
    usuario?: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[env.sessionCookieName];
  const usuario = req.cookies?.[env.sessionUserCookieName];
  if (!token || !usuario) {
    return res.status(401).json({ message: "No hay sesion activa" });
  }
  req.externalToken = token;
  req.usuario = usuario;
  next();
}
