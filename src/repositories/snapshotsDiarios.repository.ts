import { pool } from "../config/db.js";
import type { SegmentoCartera } from "../types/postventa.js";

export interface SnapshotDiarioInput {
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  nEstadoApiWorking: string | null;
  deudaTotal: number;
  segmentoCalculado: SegmentoCartera | null;
}

const LOTE = 500;

// Un registro por cliente por dia — si el job corre mas de una vez el mismo
// dia (sync programado + refresh manual), se sobreescribe la fila de hoy en
// vez de acumular duplicados.
export async function guardarSnapshots(
  snapshots: SnapshotDiarioInput[],
  fecha: string // "YYYY-MM-DD"
): Promise<void> {
  for (let i = 0; i < snapshots.length; i += LOTE) {
    const lote = snapshots.slice(i, i + LOTE);
    const placeholders = lote.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
    const params = lote.flatMap((s) => [
      s.numeroDocumentoCliente,
      fecha,
      s.idOrdenServicio,
      s.nEstadoApiWorking,
      s.deudaTotal,
      s.segmentoCalculado,
    ]);

    await pool.query(
      `INSERT INTO postventa_snapshots_diarios
        (numero_documento_cliente, fecha_snapshot, id_orden_servicio, n_estado_api_working, deuda_total, segmento_calculado)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
        id_orden_servicio = VALUES(id_orden_servicio),
        n_estado_api_working = VALUES(n_estado_api_working),
        deuda_total = VALUES(deuda_total),
        segmento_calculado = VALUES(segmento_calculado)`,
      params
    );
  }
}
