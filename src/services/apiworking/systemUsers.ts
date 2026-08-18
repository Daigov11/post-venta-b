import { getConFallback } from "./externalApi.js";

interface SystemUserRaw {
  usuario: string;
  clave: string;
  sucursal: string;
}

interface SystemUserResponse {
  codResponse?: string;
  message?: string;
  data?: {
    infoClient?: { idPersona?: string; baseDatos?: string; linkSistema?: string };
    usersClient?: SystemUserRaw[];
  } | null;
}

export interface SystemUsersResult {
  cantidadTrabajadores: number;
  // Solo nombres de usuario — la clave (password) del sistema del cliente
  // nunca se persiste ni se propaga fuera de esta llamada.
  usuarios: string[];
  // Ej. "prod_resto_restodelicado" — senal mas confiable de rubro que el
  // nombre del plan (que muchas veces no lo delata, ej. "APIWORKINGPRO/49").
  baseDatos: string | null;
}

export async function fetchSystemUsers(
  token: string,
  linkSistema: string
): Promise<SystemUsersResult | null> {
  const data = (await getConFallback(
    "/Administrativo/systemUser",
    { url: linkSistema },
    token,
    "systemUser"
  )) as SystemUserResponse;

  const usersClient = data?.data?.usersClient;
  if (!Array.isArray(usersClient)) return null;

  return {
    cantidadTrabajadores: usersClient.length,
    usuarios: usersClient.map((u) => u.usuario),
    baseDatos: data?.data?.infoClient?.baseDatos ?? null,
  };
}
