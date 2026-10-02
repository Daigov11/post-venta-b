import { createHmac } from "node:crypto";

// Identificador de sesion para postventa_sesion_apiworking: HMAC-SHA-256 del
// JWT con un secreto que solo conoce el servidor (env.sessionHmacSecret).
// A proposito NO es un hash simple del token (ej. sha256 sin secreto) — con
// un secreto de por medio, nadie que solo tenga el token puede derivar ni
// verificar esta clave sin conocer tambien el secreto del servidor.
export function hmacTokenId(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

// Decodifica (sin verificar firma) el payload de un JWT — usado solo para
// leer claims propios de un token que YA vamos a usar tal cual contra
// APIWorking (ver crearIncidencia). No hace falta verificar la firma
// nosotros: si el token fue alterado, APIWorking simplemente lo rechaza
// cuando lo usemos (401/403) — la integridad la garantiza el emisor, no
// nuestra decodificacion. Por eso esto NUNCA debe usarse para autorizar
// nada por si solo, solo para leer un dato ya presente en un token valido.
export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
