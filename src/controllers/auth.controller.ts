import type { Request, Response } from "express";
import axios from "axios";
import { env } from "../config/env.js";
import * as sesionApiWorkingRepository from "../repositories/sesionApiWorking.repository.js";
import * as usuarioAutorizadoRepository from "../repositories/usuarioAutorizado.repository.js";
import { loginExternal } from "../services/apiworking/externalApi.js";
import { MENSAJE_NO_AUTORIZADO, resolverAutorizacion } from "../services/autorizacion.service.js";
import { decodeJwtPayload, hmacTokenId } from "../utils/jwt.js";

export async function login(req: Request, res: Response) {
  const { usuario, password } = req.body ?? {};

  if (!usuario || !password) {
    return res.status(400).json({ message: "usuario y password son requeridos" });
  }

  try {
    const result = await loginExternal({ usuario, password });
    const token = result?.data?.token;

    if (!token) {
      return res.status(401).json({
        message: result?.message ?? "Credenciales invalidas",
      });
    }

    // Paso 3-4 del control de acceso: se valida ANTES de emitir cookies de
    // sesion Postventa. Si no esta en la tabla local o esta inactivo, no se
    // crea sesion aunque APIWorking haya aceptado la credencial.
    const { autorizado, usuario: usuarioAutorizado } = await resolverAutorizacion(usuario);
    if (!autorizado) {
      return res.status(403).json({ message: MENSAJE_NO_AUTORIZADO });
    }

    const cookieOptions = {
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: "lax" as const,
      maxAge: 1000 * 60 * 60 * 8, // 8 horas
    };
    res.cookie(env.sessionCookieName, token, cookieOptions);
    res.cookie(env.sessionUserCookieName, usuario, cookieOptions);

    usuarioAutorizadoRepository
      .touchUltimoAcceso(usuario)
      .catch((err) => console.error("No se pudo actualizar ultimo_acceso_en:", err));

    // id_persona nunca se guarda en una cookie (ver auditoria de seguridad
    // de "crear incidencia") — se resuelve server-side via
    // postventa_sesion_apiworking, indexada por HMAC del JWT, con la misma
    // expiracion que el propio JWT ("exp"). Si falta id_persona o el JWT no
    // trae "exp", simplemente no se puede crear seguimientos con esta sesion
    // (el controller de seguimiento lo informa) — no rompe el login.
    const idPersona = (result.data as { id_persona?: string } | undefined)?.id_persona;
    const claims = decodeJwtPayload<{ exp?: number }>(token);
    if (idPersona && claims?.exp) {
      sesionApiWorkingRepository
        .upsert({
          tokenHmac: hmacTokenId(token, env.sessionHmacSecret),
          idPersona,
          usuario,
          expiraEn: new Date(claims.exp * 1000),
        })
        .catch((err) => console.error("No se pudo guardar la sesion de APIWorking:", err));
      sesionApiWorkingRepository.limpiarVencidas().catch(() => {});
    }

    const { token: _token, ...restData } = result.data ?? {};
    return res.status(200).json({
      usuario,
      rol: usuarioAutorizado!.rol,
      ...restData,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      const message =
        (typeof error.response?.data === "string" && error.response.data) ||
        (error.response?.data as { message?: string } | undefined)?.message ||
        "No se pudo iniciar sesion";
      return res.status(status).json({ message });
    }
    console.error("Error inesperado en login:", error);
    return res.status(500).json({ message: "Error inesperado al iniciar sesion" });
  }
}

export async function me(req: Request, res: Response) {
  const token = req.cookies?.[env.sessionCookieName];
  const usuario = req.cookies?.[env.sessionUserCookieName];
  if (!token || !usuario) {
    return res.status(401).json({ authenticated: false });
  }
  const { autorizado, usuario: usuarioAutorizado } = await resolverAutorizacion(usuario);
  if (!autorizado) {
    return res.status(401).json({ authenticated: false });
  }
  return res.status(200).json({ authenticated: true, rol: usuarioAutorizado!.rol });
}

export function logout(req: Request, res: Response) {
  const token = req.cookies?.[env.sessionCookieName];
  if (token) {
    sesionApiWorkingRepository.remove(hmacTokenId(token, env.sessionHmacSecret)).catch(() => {});
  }
  res.clearCookie(env.sessionCookieName);
  res.clearCookie(env.sessionUserCookieName);
  return res.status(200).json({ message: "Sesion cerrada" });
}
