import axios from "axios";
import { env } from "../../config/env.js";

// timeout de 45s por request — sin esto, si APIWorking se cuelga (no
// responde, no tira error) el request nuestro queda esperando para siempre
// y el usuario ve un spinner sin fin del lado del frontend, sin ningun error
// que explique que paso. 45s da margen de sobra: se vio una llamada real
// tardar ~25s en responder (arranque en frio del lado de APIWorking, no un
// problema nuestro) y no queremos cortar una respuesta lenta pero valida.
export const externalApi = axios.create({
  baseURL: env.externalApiBaseUrl,
  headers: { "Content-Type": "application/json" },
  timeout: 45000,
});

export interface ExternalLoginRequest {
  usuario: string;
  password: string;
}

// La API externa siempre responde HTTP 200 (incluso con credenciales invalidas)
// y usa codResponse/data para indicar exito o fracaso:
// exito:  { codResponse: "1", message: "...", data: { token, ... } }
// fallo:  { codResponse: "0", message: "No se encontraron datos registrados", data: null }
export interface ExternalLoginResponse {
  codResponse?: string;
  message?: string;
  data?: ({ token?: string; [key: string]: unknown }) | null;
  [key: string]: unknown;
}

export async function loginExternal(
  credentials: ExternalLoginRequest
): Promise<ExternalLoginResponse> {
  const { data } = await externalApi.post<ExternalLoginResponse>(
    "/User/login",
    credentials,
    { headers: { accept: "text/plain" } }
  );
  return data;
}

export interface OrdenServicioQuery {
  fechaInicio: string;
  fechaFin: string;
  plan?: string;
  estado?: string;
  allFechas?: string | number;
  displayStart?: string | number;
  displayLength?: string | number;
  search?: string;
  // Trae el array `pagos` poblado por cada OS. Solo se pide cuando hace
  // falta (dataset completo para segmento de cartera) — la vista legacy de
  // Ordenes no lo necesita.
  incluirPago?: boolean;
}

// Algunos roles de APIWorking (ej. EJECUTIVOSENIOR) no tienen permiso sobre
// ciertos recursos y responden codResponse "403" — a veces como HTTP 403, a
// veces como HTTP 200 con el error dentro del body (mismo patron que login).
function esPermisoDenegado(payload: unknown, error?: unknown): boolean {
  if (axios.isAxiosError(error) && error.response?.status === 403) return true;
  if (payload && typeof payload === "object") {
    const codResponse = (payload as Record<string, unknown>).codResponse;
    if (codResponse !== undefined && String(codResponse) === "403") return true;
  }
  return false;
}

// GET generico con reintento automatico usando FALLBACK_API_TOKEN cuando el
// token del usuario no tiene permiso sobre el recurso solicitado.
export async function getConFallback(
  path: string,
  params: Record<string, unknown>,
  token: string,
  logLabel: string
): Promise<unknown> {
  async function request(withToken: string) {
    const { data } = await externalApi.get(path, {
      params,
      headers: { Authorization: `Bearer ${withToken}` },
    });
    return data;
  }

  try {
    const data = await request(token);
    if (esPermisoDenegado(data) && env.fallbackApiToken) {
      console.warn(
        `${logLabel}: token de usuario sin permiso (codResponse 403), reintentando con FALLBACK_API_TOKEN`
      );
      return await request(env.fallbackApiToken);
    }
    return data;
  } catch (error) {
    if (esPermisoDenegado(undefined, error) && env.fallbackApiToken) {
      console.warn(
        `${logLabel}: token de usuario sin permiso (HTTP 403), reintentando con FALLBACK_API_TOKEN`
      );
      return await request(env.fallbackApiToken);
    }
    throw error;
  }
}

// El endpoint externo expone el parametro con el typo "displatyLength" (asi tal cual).
export async function fetchOrdenesServicio(
  token: string,
  query: OrdenServicioQuery
): Promise<unknown> {
  return getConFallback(
    "/Administrativo/orden-servicio",
    {
      fechaInicio: query.fechaInicio,
      fechaFin: query.fechaFin,
      plan: query.plan ?? "ALL",
      estado: query.estado ?? "ALL",
      allFechas: query.allFechas ?? 0,
      displayStart: query.displayStart ?? 0,
      displatyLength: query.displayLength ?? 100,
      search: query.search ?? "",
      incluirPago: query.incluirPago ? 1 : 0,
    },
    token,
    "orden-servicio"
  );
}

export interface PostVentaQuery {
  f1: string;
  f2: string;
  displayStart?: string | number;
  displayLength?: string | number;
}

// Endpoint separado (no es "orden-servicio"), requiere rol _SISTEMAS — un
// usuario normal (ej. EJECUTIVOSENIOR) recibe codResponse "403" y
// getConFallback reintenta con FALLBACK_API_TOKEN, igual que en orden-servicio.
// Falla con fechas anteriores al 25-09-2022 (error de conversion de fecha del
// lado de APIWorking, confirmado probando el rango) — ver sync.post_venta_fecha_inicio.
export interface HistorialSeguimientoQuery {
  idOrdenServicio: number | string;
  displayStart?: string | number;
  displayLength?: string | number;
  search?: string;
}

// origen=1 (Orden de Servicio) es el unico soportado hoy — el endpoint
// tambien acepta origen=2 (Capacitaciones) y 3 (Misiones), pero esos piden
// idCapacitacion/idMision, que no existen en nuestro dataset (solo tenemos
// idOrdenServicio). Se deja fijo en 1 hasta que haya de donde sacar esos IDs.
export async function fetchHistorialSeguimiento(
  token: string,
  query: HistorialSeguimientoQuery
): Promise<unknown> {
  return getConFallback(
    "/Administrativo/historial-seguimiento",
    {
      origen: 1,
      idSeguimiento: query.idOrdenServicio,
      displayStart: query.displayStart ?? 0,
      displatyLength: query.displayLength ?? 300,
      search: query.search ?? "",
    },
    token,
    "historial-seguimiento"
  );
}

export interface IncidenciasQuery {
  // Filtra por numeroDocumentoCliente (o numero_os, otros campos matchean
  // tambien) — confirmado probando contra datos reales, no documentado.
  search: string;
  displayStart?: string | number;
  displayLength?: string | number;
}

// fechaInicio/fechaFin son requeridos por el endpoint aunque allFechas=1 los
// ignore en la practica (confirmado probando el rango completo vs uno
// acotado, mismo total) — se manda un rango fijo bien amplio.
export async function fetchIncidencias(token: string, query: IncidenciasQuery): Promise<unknown> {
  return getConFallback(
    "/Administrativo/incidencias",
    {
      allFechas: 1,
      fechaInicio: "2000-01-01",
      fechaFin: new Date().toISOString().slice(0, 10),
      displayStart: query.displayStart ?? 0,
      displayLength: query.displayLength ?? 300,
      search: query.search,
    },
    token,
    "incidencias"
  );
}

export async function fetchPostVenta(token: string, query: PostVentaQuery): Promise<unknown> {
  return getConFallback(
    "/Administrativo/post-venta",
    {
      f1: query.f1,
      f2: query.f2,
      plan: "ALL",
      estadoSistema: "ALL",
      estadoSunat: "ALL",
      estadoCapacitado: "ALL",
      // BUG encontrado y corregido: "0" no es "sin filtro" para este parametro
      // — es un filtro literal a "clientes SIN deuda". Con tienDeuda:0
      // estabamos excluyendo del pull a todo cliente con deuda activa,
      // exactamente los que mas importan para cobranza/segmento. Confirmado
      // con pruebas reales: tienDeuda:0 -> 98 filas (sin El Sanguchero, que
      // debe S/93.22), tienDeuda:"ALL" -> 104 filas (con El Sanguchero).
      tienDeuda: "ALL",
      tienContrato: "ALL",
      tipoPlan: "ALL",
      allFechas: 0,
      afiliadoSunatGrid: "ALL",
      cicloFacturacionGrid: "ALL",
      displayStart: query.displayStart ?? 0,
      displatyLength: query.displayLength ?? 500,
    },
    token,
    "post-venta"
  );
}
