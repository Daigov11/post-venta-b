import type { RawIncidenciaItem } from "../../mappers/incidencias.mapper.js";
import { fetchIncidencias } from "./externalApi.js";

const PAGE_SIZE = 500;
// ~36k incidencias historicas al momento de escribir esto — 100 paginas de
// 500 cubre hasta 50k, con margen para que siga creciendo.
const MAX_PAGES = 100;

function extractRows(payload: unknown): RawIncidenciaItem[] {
  if (Array.isArray(payload)) return payload as RawIncidenciaItem[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const candidate = obj.data ?? obj.result ?? obj.items;
    if (Array.isArray(candidate)) return candidate as RawIncidenciaItem[];
  }
  return [];
}

function extractTotal(rows: RawIncidenciaItem[]): number | null {
  return typeof rows[0]?.total === "number" ? rows[0].total : null;
}

// Trae TODAS las incidencias historicas (sin filtrar por cliente) — usado
// solo por el sync diario compartido, para precalcular por cliente si tiene
// una incidencia "DAR DE ALTA AL CLIENTE" sin resolver (ver
// enrichCliente.ts). Nunca se llama por request de usuario — 36k+ filas es
// demasiado para pedirlo en vivo, igual que orden-servicio/post-venta.
export async function fetchAllIncidencias(token: string): Promise<RawIncidenciaItem[]> {
  const all: RawIncidenciaItem[] = [];
  let displayStart = 0;
  let knownTotal: number | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const payload = await fetchIncidencias(token, {
      displayStart,
      displayLength: PAGE_SIZE,
    });

    const rows = extractRows(payload);
    if (knownTotal === null) knownTotal = extractTotal(rows);
    all.push(...rows);

    if (rows.length === 0) break;
    displayStart += rows.length;
    if (rows.length < PAGE_SIZE) break;
    if (knownTotal !== null && displayStart >= knownTotal) break;
  }

  return all;
}
