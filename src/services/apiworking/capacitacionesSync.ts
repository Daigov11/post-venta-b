import type { RawCapacitacionItem } from "../../mappers/capacitaciones.mapper.js";
import { fetchCapacitaciones } from "./externalApi.js";

function extractRows(payload: unknown): RawCapacitacionItem[] {
  if (Array.isArray(payload)) return payload as RawCapacitacionItem[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const candidate = obj.data ?? obj.result ?? obj.items;
    if (Array.isArray(candidate)) return candidate as RawCapacitacionItem[];
  }
  return [];
}

// A diferencia de ordenes/post-venta/incidencias, este endpoint no tiene
// paginacion real (ningun parametro de filtro probado tuvo efecto) — siempre
// devuelve el listado completo en una sola llamada.
export async function fetchAllCapacitaciones(token: string): Promise<RawCapacitacionItem[]> {
  const payload = await fetchCapacitaciones(token);
  return extractRows(payload);
}
