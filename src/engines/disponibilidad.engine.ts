import type { ModalidadReunion } from "../types/postventa.js";

// Regla de negocio confirmada: atencion 9:00-18:00, Lunes a Sabado (domingo
// cerrado), slots candidatos cada 30 min. Duracion fija segun modalidad —
// virtual 30 min, presencial 1h30 — no configurable por ahora.
const HORA_APERTURA_MIN = 9 * 60;
const HORA_CIERRE_MIN = 18 * 60;
const INTERVALO_MIN = 30;
const DURACION_MIN: Record<ModalidadReunion, number> = {
  VIRTUAL: 30,
  PRESENCIAL: 90,
};

export interface RangoHora {
  horaInicio: string; // "HH:mm"
  horaFin: string; // "HH:mm"
}

function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function minutosAHora(minutos: number): string {
  const h = Math.floor(minutos / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutos % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// new Date("YYYY-MM-DD") se interpreta en UTC — getUTCDay() evita el
// corrimiento de un dia que daria getDay() en zonas horarias negativas.
function esDomingo(fecha: string): boolean {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay() === 0;
}

function seSuperponen(aInicio: number, aFin: number, bInicio: number, bFin: number): boolean {
  return aInicio < bFin && bInicio < aFin;
}

// Devuelve los horarios de inicio ("HH:mm") disponibles para un asesor en una
// fecha, dada su modalidad (define la duracion) y sus reuniones PROGRAMADA ya
// existentes ese dia (para no ofrecer un slot que choque). Domingo -> [].
export function generarSlotsDisponibles(
  fecha: string,
  modalidad: ModalidadReunion,
  reunionesExistentes: RangoHora[]
): string[] {
  if (esDomingo(fecha)) return [];

  const duracion = DURACION_MIN[modalidad];
  const ocupados = reunionesExistentes.map((r) => ({
    inicio: horaAMinutos(r.horaInicio),
    fin: horaAMinutos(r.horaFin),
  }));

  const slots: string[] = [];
  for (
    let inicio = HORA_APERTURA_MIN;
    inicio + duracion <= HORA_CIERRE_MIN;
    inicio += INTERVALO_MIN
  ) {
    const fin = inicio + duracion;
    const choca = ocupados.some((o) => seSuperponen(inicio, fin, o.inicio, o.fin));
    if (!choca) slots.push(minutosAHora(inicio));
  }
  return slots;
}

// Confirma que un horario propuesto (al crear la reunion) sigue siendo valido
// — reglas de negocio + que no choque con lo ya agendado. Se revalida en el
// backend al crear (no basta con que el frontend haya ofrecido el slot,
// puede haberse ocupado entre que se cargo la disponibilidad y se confirmo).
export function validarHorario(
  fecha: string,
  horaInicio: string,
  modalidad: ModalidadReunion,
  reunionesExistentes: RangoHora[]
): { valido: true } | { valido: false; motivo: string } {
  if (esDomingo(fecha)) return { valido: false, motivo: "No hay atención los domingos." };

  const duracion = DURACION_MIN[modalidad];
  const inicio = horaAMinutos(horaInicio);
  const fin = inicio + duracion;

  if (inicio < HORA_APERTURA_MIN || fin > HORA_CIERRE_MIN) {
    return { valido: false, motivo: "Fuera del horario de atención (9:00-18:00)." };
  }
  if ((inicio - HORA_APERTURA_MIN) % INTERVALO_MIN !== 0) {
    return { valido: false, motivo: "El horario debe caer en un intervalo de 30 minutos." };
  }

  const ocupados = reunionesExistentes.map((r) => ({
    inicio: horaAMinutos(r.horaInicio),
    fin: horaAMinutos(r.horaFin),
  }));
  const choca = ocupados.some((o) => seSuperponen(inicio, fin, o.inicio, o.fin));
  if (choca) return { valido: false, motivo: "El asesor ya tiene una reunión en ese horario." };

  return { valido: true };
}

export function calcularHoraFin(horaInicio: string, modalidad: ModalidadReunion): string {
  return minutosAHora(horaAMinutos(horaInicio) + DURACION_MIN[modalidad]);
}
