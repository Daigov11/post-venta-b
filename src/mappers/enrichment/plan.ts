import type { Periodicidad } from "../../types/postventa.js";

const PERIODICIDAD_MULTIPLIER: Record<Exclude<Periodicidad, "DESCONOCIDO">, number> = {
  MENSUAL: 12,
  TRIMESTRAL: 4,
  SEMESTRAL: 2,
  ANUAL: 1,
};

// nTipoPlan (orden-servicio) es un dato declarado por APIWorking, no una
// adivinanza — cubre practicamente el 100% de las OS (2539/2543 en una
// muestra real) y es la fuente primaria. Valores confirmados: "Mensual",
// "Trimestral", "Semestral", "Anual", y un caso raro "Quincenal" que no
// tenemos como periodicidad soportada (queda DESCONOCIDO, no se inventa un
// ciclo de 15 dias que no tiene reglas de negocio definidas).
function detectPeriodicidadDesdeTipoPlan(nTipoPlan: string | null): Periodicidad | null {
  if (!nTipoPlan) return null;
  const normalizado = nTipoPlan.trim().toUpperCase();
  if (normalizado === "MENSUAL") return "MENSUAL";
  if (normalizado === "TRIMESTRAL") return "TRIMESTRAL";
  if (normalizado === "SEMESTRAL") return "SEMESTRAL";
  if (normalizado === "ANUAL") return "ANUAL";
  return null;
}

// Respaldo por palabra clave en el nombre del plan — solo se usa cuando
// nTipoPlan no vino o no matchea un valor reconocido. Confirmada su
// necesidad: hay OS sin nTipoPlan (raro, ~0.2%) y el nombre a veces alcanza
// para deducirlo igual.
function detectPeriodicidadDesdeNombre(nombrePlan: string): Periodicidad {
  const upper = nombrePlan.toUpperCase();
  if (upper.includes("MENSUAL")) return "MENSUAL";
  if (upper.includes("TRIMESTRAL")) return "TRIMESTRAL";
  if (upper.includes("SEMESTRAL")) return "SEMESTRAL";
  if (upper.includes("ANUAL")) return "ANUAL";
  return "DESCONOCIDO";
}

function detectPeriodicidad(nombrePlan: string, nTipoPlan: string | null): Periodicidad {
  return detectPeriodicidadDesdeTipoPlan(nTipoPlan) ?? detectPeriodicidadDesdeNombre(nombrePlan);
}

// Heuristica: el precio suele aparecer como el ultimo numero del nombre del
// plan (ej. "PLAN RESTO BASICO TRIMESTRAL 350", "RESTO PRO ANUAL/1699").
// Si no se puede determinar con confianza, se devuelve null/"No determinado"
// en vez de inventar un valor (nunca adivinar un precio).
function detectPrecio(nombrePlan: string): number | null {
  const matches = nombrePlan.match(/\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  const last = Number(matches[matches.length - 1]);
  return Number.isFinite(last) ? last : null;
}

export function parsePlan(
  nombrePlan: string,
  nTipoPlan: string | null = null
): {
  periodicidad: Periodicidad;
  precio: number | null;
  precioAnualProyectado: number | "No determinado";
} {
  const periodicidad = detectPeriodicidad(nombrePlan, nTipoPlan);
  const precio = detectPrecio(nombrePlan);

  if (periodicidad === "DESCONOCIDO" || precio === null) {
    return { periodicidad, precio, precioAnualProyectado: "No determinado" };
  }

  const precioAnualProyectado = precio * PERIODICIDAD_MULTIPLIER[periodicidad];
  return { periodicidad, precio, precioAnualProyectado };
}
