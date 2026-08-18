import type { Request, Response } from "express";
import axios from "axios";
import { env } from "../config/env.js";
import { loginExternal } from "../services/apiworking/externalApi.js";

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

    const cookieOptions = {
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: "lax" as const,
      maxAge: 1000 * 60 * 60 * 8, // 8 horas
    };
    res.cookie(env.sessionCookieName, token, cookieOptions);
    res.cookie(env.sessionUserCookieName, usuario, cookieOptions);

    const { token: _token, ...restData } = result.data ?? {};
    return res.status(200).json({
      usuario,
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

export function me(req: Request, res: Response) {
  const token = req.cookies?.[env.sessionCookieName];
  if (!token) {
    return res.status(401).json({ authenticated: false });
  }
  return res.status(200).json({ authenticated: true });
}

export function logout(req: Request, res: Response) {
  res.clearCookie(env.sessionCookieName);
  res.clearCookie(env.sessionUserCookieName);
  return res.status(200).json({ message: "Sesion cerrada" });
}
