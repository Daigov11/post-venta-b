import { env } from "../../config/env.js";
import type { RawPostVenta } from "../../types/postventa.js";
import { fetchPostVenta } from "./externalApi.js";

// Misma forma defensiva que ordenesSync.ts — este endpoint tampoco trae un
// campo `total` (ni a nivel payload ni por fila), asi que la paginacion se
// corta unicamente cuando vienen menos filas de las pedidas.
function extractRows(payload: unknown): RawPostVenta[] {
  if (Array.isArray(payload)) return payload as RawPostVenta[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const candidate = obj.data ?? obj.result ?? obj.items ?? obj.aaData;
    if (Array.isArray(candidate)) return candidate as RawPostVenta[];
  }
  return [];
}

export async function fetchAllPostVenta(
  token: string,
  range: { f1: string; f2: string }
): Promise<RawPostVenta[]> {
  const pageSize = env.ordenesSync.pageSize;
  const all: RawPostVenta[] = [];
  let displayStart = 0;

  for (let page = 0; page < env.ordenesSync.maxPages; page++) {
    const payload = await fetchPostVenta(token, {
      f1: range.f1,
      f2: range.f2,
      displayStart,
      displayLength: pageSize,
    });

    const rows = extractRows(payload);
    all.push(...rows);

    if (rows.length === 0) break;
    displayStart += rows.length;
    if (rows.length < pageSize) break; // la API devolvio menos de lo pedido: no hay mas paginas
  }

  return all;
}
