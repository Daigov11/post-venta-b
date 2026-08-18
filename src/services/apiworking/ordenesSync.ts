import { env } from "../../config/env.js";
import type { RawOrdenServicio } from "../../types/postventa.js";
import { fetchOrdenesServicio } from "./externalApi.js";

// La forma exacta de la respuesta no esta 100% documentada (puede ser un
// arreglo plano o venir envuelta en { data: [...] } estilo DataTables), asi
// que la interpretamos de forma defensiva, igual que ya hacia el frontend
// legacy en pages/Ordenes.tsx.
function extractRows(payload: unknown): RawOrdenServicio[] {
  if (Array.isArray(payload)) return payload as RawOrdenServicio[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const candidate = obj.data ?? obj.result ?? obj.items ?? obj.aaData;
    if (Array.isArray(candidate)) return candidate as RawOrdenServicio[];
  }
  return [];
}

function extractTotal(payload: unknown, rows: RawOrdenServicio[]): number | null {
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const total =
      obj.recordsFiltered ??
      obj.recordsTotal ??
      obj.iTotalDisplayRecords ??
      obj.iTotalRecords ??
      obj.total;
    if (typeof total === "number") return total;
  }
  if (rows[0] && typeof rows[0].total === "number") return rows[0].total;
  return null;
}

export async function fetchAllOrdenesServicio(
  token: string,
  range: { fechaInicio: string; fechaFin: string }
): Promise<RawOrdenServicio[]> {
  const pageSize = env.ordenesSync.pageSize;
  const all: RawOrdenServicio[] = [];
  let displayStart = 0;
  let knownTotal: number | null = null;

  for (let page = 0; page < env.ordenesSync.maxPages; page++) {
    const payload = await fetchOrdenesServicio(token, {
      fechaInicio: range.fechaInicio,
      fechaFin: range.fechaFin,
      plan: "ALL",
      estado: "ALL",
      allFechas: 0,
      displayStart,
      displayLength: pageSize,
      search: "",
      incluirPago: true,
    });

    const rows = extractRows(payload);
    if (knownTotal === null) {
      knownTotal = extractTotal(payload, rows);
    }
    all.push(...rows);

    if (rows.length === 0) break;
    displayStart += rows.length;
    if (rows.length < pageSize) break; // la API devolvio menos de lo pedido: no hay mas paginas
    if (knownTotal !== null && displayStart >= knownTotal) break;
  }

  return all;
}
