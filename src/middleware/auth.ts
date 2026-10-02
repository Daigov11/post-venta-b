import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { asyncHandler } from "./asyncHandler.js";
import { MENSAJE_NO_AUTORIZADO, resolverAutorizacion } from "../services/autorizacion.service.js";
import type { RolUsuario } from "../types/usuarioAutorizado.js";

declare module "express-serve-static-core" {
  interface Request {
    externalToken?: string;
    usuario?: string;
    rolUsuario?: RolUsuario;
  }
}

// Ahora hace una consulta a postventa_usuarios_autorizados en CADA request
// (ver autorizacion.service.ts): antes solo miraba que existan las cookies.
// Envuelto en asyncHandler porque Express 4 no atrapa una Promise
// rechazada en un middleware — sin esto, un error de MySQL aca colgaria el
// request en vez de caer en errorHandler.
export const requireAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[env.sessionCookieName];
  const usuario = req.cookies?.[env.sessionUserCookieName];
  if (!token || !usuario) {
    return res.status(401).json({ message: "No hay sesion activa" });
  }

  const { autorizado, usuario: usuarioAutorizado } = await resolverAutorizacion(usuario);
  if (!autorizado) {
    return res.status(403).json({ message: MENSAJE_NO_AUTORIZADO });
  }

  req.externalToken = token;
  req.usuario = usuario;
  req.rolUsuario = usuarioAutorizado!.rol;
  next();
});

// Factory de gate por rol — se coloca SIEMPRE despues de requireAuth (propio
// o via router.use) en la cadena de middlewares, porque depende de
// req.rolUsuario ya resuelto. Sincrono: no hace falta asyncHandler.
export function requireRol(...rolesPermitidos: RolUsuario[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    if (!req.rolUsuario || !rolesPermitidos.includes(req.rolUsuario)) {
      return res.status(403).json({
        message: "No tienes permiso para acceder a este modulo.",
      });
    }
    next();
  };
}
