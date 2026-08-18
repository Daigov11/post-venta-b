import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  frontendOrigin: required("FRONTEND_ORIGIN", "http://localhost:5173"),
  externalApiBaseUrl: required(
    "EXTERNAL_API_BASE_URL",
    "https://api-centralizador.apiworking.pe/api"
  ),
  sessionCookieName: required("SESSION_COOKIE_NAME", "pv_token"),
  sessionUserCookieName: required("SESSION_USER_COOKIE_NAME", "pv_user"),
  cookieSecure: (process.env.COOKIE_SECURE ?? "false") === "true",
  mysql: {
    host: process.env.MYSQL_HOST ?? "localhost",
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE ?? "post_venta",
  },
  ordenesSync: {
    pageSize: Number(process.env.ORDENES_SYNC_PAGE_SIZE ?? 500),
    maxPages: Number(process.env.ORDENES_SYNC_MAX_PAGES ?? 50),
  },
  configCacheTtlMs: Number(process.env.CONFIG_CACHE_TTL_MS ?? 60000),
  // Token de respaldo. Cumple DOS roles hoy:
  //  1) Reintento cuando el rol del usuario logueado no tiene permiso sobre
  //     un recurso puntual (APIWorking responde codResponse "403").
  //  2) Credencial del sync diario compartido (services/postventa/scheduler.ts)
  //     — SIN este token no hay forma de refrescar el dataset compartido para
  //     nadie, asi que ya no es un fallback ocasional, es una dependencia real.
  // Es un JWT fijo, NO se renueva solo — expira y hay que reemplazarlo a mano.
  // No se hace obligatorio con throw al arrancar: si falta, el server sigue
  // funcionando (login, notas, tareas, /ordenes legacy no lo necesitan) pero
  // el dataset compartido queda vacio hasta que se configure — el error queda
  // bien visible en el log de arranque y en cualquier endpoint que lo necesite.
  fallbackApiToken: process.env.FALLBACK_API_TOKEN || null,
};
