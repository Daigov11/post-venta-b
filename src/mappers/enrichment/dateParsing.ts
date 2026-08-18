// APIWorking devuelve fechas en formatos fijos conocidos:
//  - "M/D/YYYY h:mm:ss AM/PM" (fechaOs, fechaSistema)
//  - "DD-MM-YYYY" (fechaFormat, pruebaFechaInicio)
//  - "DD-MM-YYYY h:mm AM/PM" (fecha_inactivo_formato, endpoint post-venta)
// No se agrega una libreria de fechas para solo estos casos.

const US_DATETIME_RE =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i;
const DMY_DATE_RE = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
const DMY_DATETIME_RE = /^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

export function parseUsDateTime(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const match = US_DATETIME_RE.exec(raw.trim());
  if (!match) return null;

  const [, monthStr, dayStr, yearStr, hourStr, minuteStr, secondStr, meridiem] = match;
  let hour = Number(hourStr) % 12;
  if (meridiem.toUpperCase() === "PM") hour += 12;

  const date = new Date(
    Number(yearStr),
    Number(monthStr) - 1,
    Number(dayStr),
    hour,
    Number(minuteStr),
    Number(secondStr)
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseDmyDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const match = DMY_DATE_RE.exec(raw.trim());
  if (!match) return null;

  const [, dayStr, monthStr, yearStr] = match;
  const date = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr));
  return Number.isNaN(date.getTime()) ? null : date;
}

// El endpoint post-venta usa "00-00-0000 12:00 AM" como valor centinela para
// "nunca paso esto" (ej. fecha_inactivo_formato de un cliente que nunca
// estuvo inactivo) — no es una fecha real, se trata como null.
export function parseDmyDateTime(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("00-00-0000")) return null;

  const match = DMY_DATETIME_RE.exec(trimmed);
  if (!match) return null;

  const [, dayStr, monthStr, yearStr, hourStr, minuteStr, meridiem] = match;
  let hour = Number(hourStr) % 12;
  if (meridiem.toUpperCase() === "PM") hour += 12;

  const date = new Date(
    Number(yearStr),
    Number(monthStr) - 1,
    Number(dayStr),
    hour,
    Number(minuteStr)
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoOrNull(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}
