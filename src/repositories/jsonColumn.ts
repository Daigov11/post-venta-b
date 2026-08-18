// mysql2 a veces devuelve columnas JSON ya parseadas (objeto/array) y a veces
// como string, segun como el servidor reporte el tipo de columna (MariaDB
// implementa JSON como LONGTEXT + CHECK, MySQL como tipo nativo). Manejar
// ambos casos evita depender del comportamiento exacto del driver/servidor.
export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}
