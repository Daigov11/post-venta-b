import type { RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";

export async function listInteresIdsByCliente(numeroDocumentoCliente: string): Promise<number[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT interes_id FROM postventa_cliente_intereses WHERE numero_documento_cliente = ?",
    [numeroDocumentoCliente]
  );
  return rows.map((r) => Number(r.interes_id));
}

// Multi-select simple: reemplaza el set completo de intereses marcados para
// el cliente por el que llega — mas simple que calcular el diff, y el caso
// de uso (tildar/destildar checkboxes en un panel) siempre manda la lista
// completa. Corre en una transaccion para que no quede a medio guardar.
export async function reemplazarIntereses(
  numeroDocumentoCliente: string,
  interesIds: number[],
  marcadoPor: string
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM postventa_cliente_intereses WHERE numero_documento_cliente = ?", [
      numeroDocumentoCliente,
    ]);
    if (interesIds.length > 0) {
      const values = interesIds.map((id) => [numeroDocumentoCliente, id, marcadoPor]);
      await conn.query(
        "INSERT INTO postventa_cliente_intereses (numero_documento_cliente, interes_id, marcado_por) VALUES ?",
        [values]
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
