import {
  mapHistorialSeguimientoItem,
  type RawHistorialSeguimientoItem,
} from "../../mappers/historialSeguimiento.mapper.js";
import { fetchHistorialSeguimiento } from "../apiworking/externalApi.js";
import { env } from "../../config/env.js";

interface RawHistorialResponse {
  codResponse?: string;
  message?: string;
  data?: unknown;
}

// Busca en el historial de seguimiento de la OS el evento mas reciente que
// paso el estado a "CLIENTE DE BAJA" — es la unica fuente real de "cuando fue
// dado de baja" (no esta guardado en ningun otro lado). Usa el token
// compartido (mismo que el sync diario) porque esto corre como parte de un
// listado administrativo, no atado a la sesion de un usuario puntual.
// null si nunca hubo ese evento (nunca se inventa una fecha).
export async function buscarFechaBaja(idOrdenServicio: number): Promise<string | null> {
  const token = env.fallbackApiToken;
  if (!token) return null;

  const raw = (await fetchHistorialSeguimiento(token, { idOrdenServicio })) as RawHistorialResponse;
  const filas = Array.isArray(raw?.data) ? (raw.data as RawHistorialSeguimientoItem[]) : [];
  const eventosBaja = filas
    .map(mapHistorialSeguimientoItem)
    .filter((ev) => ev.estado.trim().toUpperCase() === "CLIENTE DE BAJA" && ev.fecha !== null);

  if (eventosBaja.length === 0) return null;
  return eventosBaja.reduce((a, b) => ((a.fecha as string) > (b.fecha as string) ? a : b)).fecha;
}
