import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";

interface SesionRow extends RowDataPacket {
  token_hmac: string;
  id_persona: string;
  usuario: string;
  expira_en: Date;
}

// Se guarda en el login (ver auth.controller.ts) y se consulta solo cuando
// hace falta idPersona para una escritura (ej. crear seguimiento) — nunca se
// guarda el JWT ni un hash simple de el, ver utils/jwt.ts#hmacTokenId.
export async function upsert(input: {
  tokenHmac: string;
  idPersona: string;
  usuario: string;
  expiraEn: Date;
}): Promise<void> {
  await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_sesion_apiworking (token_hmac, id_persona, usuario, expira_en)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id_persona = VALUES(id_persona), usuario = VALUES(usuario), expira_en = VALUES(expira_en)`,
    [input.tokenHmac, input.idPersona, input.usuario, input.expiraEn]
  );
}

// Devuelve idPersona solo si la fila existe Y no esta vencida — una sesion
// vencida no debe resolver un idPersona "viejo" aunque la fila siga en la
// tabla (se limpia despues, ver limpiarVencidas).
export async function findIdPersonaVigente(tokenHmac: string): Promise<string | null> {
  const [rows] = await pool.query<SesionRow[]>(
    "SELECT * FROM postventa_sesion_apiworking WHERE token_hmac = ? AND expira_en > NOW()",
    [tokenHmac]
  );
  return rows[0]?.id_persona ?? null;
}

export async function remove(tokenHmac: string): Promise<void> {
  await pool.query("DELETE FROM postventa_sesion_apiworking WHERE token_hmac = ?", [tokenHmac]);
}

// Housekeeping barato — se llama de paso en cada login, no hace falta un cron
// dedicado para un volumen tan chico de filas.
export async function limpiarVencidas(): Promise<void> {
  await pool.query("DELETE FROM postventa_sesion_apiworking WHERE expira_en <= NOW()");
}
