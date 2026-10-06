// Logica PURA (sin base de datos ni reloj implicito) del contacto programado
// de la cartera: que clientes entran, cuando les toca y como se reparte la
// carga entre los dias habiles y las personas del equipo. Separada del
// servicio para poder probarla con datos fijos.
//
// Todas las fechas viajan como "YYYY-MM-DD". La aritmetica se hace en UTC
// sobre esa cadena, nunca con Date locales: el proceso corre con
// TZ=America/Lima, y toISOString() sobre una fecha local movia el dia
// despues de las 19:00.

export type Iso = string;

// Unico estado de APIWorking que entra al contacto programado (confirmado
// con negocio). Se compara normalizado, igual que el resto del modulo.
const ESTADO_ACTIVO_CONTACTO = "INICIAR COBRANZA";

export function esClienteActivoParaContacto(nEstadoApiWorking: string): boolean {
  return nEstadoApiWorking.trim().toUpperCase() === ESTADO_ACTIVO_CONTACTO;
}

// Cuantos dias habiles se puede mover un contacto desde su fecha nominal
// para no sobrecargar un dia. Corto a proposito: la fecha sigue siendo la
// del ciclo de pago, solo se evita que un dia concentre a todos.
export const TOLERANCIA_DIAS_HABILES = 3;

// Semestral y anual se contactan cada 2 meses contados hacia atras desde su
// renovacion (confirmado con negocio).
const MESES_ENTRE_CONTACTOS = 2;
const MESES_POR_PERIODICIDAD: Record<string, number> = { SEMESTRAL: 6, ANUAL: 12 };

function parseIso(iso: Iso): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatIso(fecha: Date): Iso {
  return fecha.toISOString().slice(0, 10);
}

export function hoyLocalIso(ahora: Date = new Date()): Iso {
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, "0");
  const d = String(ahora.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function periodoDe(iso: Iso): string {
  return iso.slice(0, 7);
}

export function finDeMes(iso: Iso): Iso {
  const f = parseIso(iso);
  return formatIso(new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0)));
}

// Suma meses conservando el dia; si el mes destino es mas corto cae en su
// ultimo dia (31-ene + 1 mes = 28/29-feb), no desborda al mes siguiente.
export function sumarMeses(iso: Iso, meses: number): Iso {
  const f = parseIso(iso);
  const destino = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + meses, 1));
  const ultimoDia = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
  destino.setUTCDate(Math.min(f.getUTCDate(), ultimoDia));
  return formatIso(destino);
}

// "Trabajamos de lunes a sabado" (confirmado) — solo se excluye el domingo.
// No existe un calendario de feriados en el sistema, asi que no se excluyen.
export function esDiaHabil(iso: Iso): boolean {
  return parseIso(iso).getUTCDay() !== 0;
}

export function diasHabilesEntre(desde: Iso, hasta: Iso): Iso[] {
  const dias: Iso[] = [];
  const cursor = parseIso(desde);
  const limite = parseIso(hasta).getTime();
  while (cursor.getTime() <= limite) {
    const iso = formatIso(cursor);
    if (esDiaHabil(iso)) dias.push(iso);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dias;
}

export type ContactoDelPeriodo =
  | { tipo: "LIBRE"; motivo: string }
  // atrasado: la fecha del ciclo cayo en un mes anterior y aun no vence la
  // renovacion; el llamador decide si ya se genero antes (ver
  // sincronizarPeriodo) y, si no, se agenda desde hoy.
  | { tipo: "FECHA"; fecha: Iso; motivo: string; atrasado?: boolean }
  | null;

// Dias antes de la renovacion en que se contacta a un trimestral (confirmado
// con negocio: "2 semanas antes de su renovacion").
const DIAS_ANTES_TRIMESTRAL = 14;

// Que contacto le toca a un cliente en un periodo (YYYY-MM), segun su
// periodicidad. Devuelve null cuando no le toca ninguno ESTE mes.
//
//  - MENSUAL: uno por mes, en cualquier dia (solo se balancea la carga).
//  - TRIMESTRAL: 14 dias antes de renovar.
//  - SEMESTRAL / ANUAL: cada 2 meses hacia atras desde la renovacion,
//    incluida la fecha de la propia renovacion (el dia que les toca pagar).
export function contactoDelPeriodo(
  periodicidad: string,
  proximaRenovacion: string | null,
  periodo: string,
  hoy: Iso
): ContactoDelPeriodo {
  if (periodicidad === "MENSUAL") {
    return { tipo: "LIBRE", motivo: "Seguimiento mensual" };
  }
  if (!proximaRenovacion) return null;
  const renovacion = proximaRenovacion.slice(0, 10);

  if (periodicidad === "TRIMESTRAL") {
    const fecha = formatIso(new Date(parseIso(renovacion).getTime() - DIAS_ANTES_TRIMESTRAL * 86_400_000));
    const motivo = `Contacto ${DIAS_ANTES_TRIMESTRAL} días antes de su renovación (${renovacion})`;
    if (periodoDe(fecha) === periodo) return { tipo: "FECHA", fecha, motivo };
    if (fecha < `${periodo}-01` && renovacion >= hoy) return { tipo: "FECHA", fecha, motivo, atrasado: true };
    return null;
  }

  const mesesCiclo = MESES_POR_PERIODICIDAD[periodicidad];
  if (!mesesCiclo) return null;
  const pasos = mesesCiclo / MESES_ENTRE_CONTACTOS;
  for (let k = 0; k < pasos; k++) {
    const meses = k * MESES_ENTRE_CONTACTOS;
    const fecha = sumarMeses(renovacion, -meses);
    if (periodoDe(fecha) === periodo) {
      return {
        tipo: "FECHA",
        fecha,
        motivo:
          k === 0
            ? `Contacto por su renovación (${renovacion})`
            : `Seguimiento cada 2 meses — faltan ${meses} meses para su renovación (${renovacion})`,
      };
    }
  }
  return null;
}

export interface ItemParaPlanificar {
  clave: string;
  contacto: NonNullable<ContactoDelPeriodo>;
  // Quien lo atendio la ultima vez: se mantiene si no rompe el balance, para
  // que el cliente conserve a la misma persona de un mes a otro.
  ultimoResponsable?: string;
}

export interface CargaExistente {
  fecha: Iso;
  responsable: string;
  total: number;
}

export interface Asignacion {
  clave: string;
  fecha: Iso;
  responsable: string;
}

export interface OpcionesPlan {
  hoy: Iso;
  finPeriodo: Iso;
  receptores: string[];
  cargaBase: CargaExistente[];
}

// Reparte los items entre los dias habiles que quedan del periodo y entre
// los receptores, buscando que ningun dia ni ninguna persona quede
// sobrecargada:
//   1. Los de fecha fija van primero y buscan el dia menos cargado dentro de
//      +-TOLERANCIA_DIAS_HABILES de su fecha nominal (desempate: el mas
//      cercano a la fecha).
//   2. Los libres llenan despues los dias mas vacios, sin pasar de lo ya
//      puesto; asi los de fecha fija no quedan apilados.
//   3. En cada dia, la persona con menos tareas ese dia (diferencia maxima
//      entre personas: 1). Si el responsable anterior esta empatado en el
//      minimo se respeta, para dar continuidad al cliente.
// Nunca asigna antes de `hoy` (no crea tareas vencidas de arranque). Es
// determinista: mismos datos de entrada, mismo resultado.
export function planificarContactos(items: ItemParaPlanificar[], opciones: OpcionesPlan): Asignacion[] {
  const { hoy, finPeriodo, receptores, cargaBase } = opciones;
  const dias = diasHabilesEntre(hoy, finPeriodo);
  if (items.length === 0 || dias.length === 0 || receptores.length === 0) return [];

  const receptoresSet = new Set(receptores);
  const cargaDia = new Map<Iso, number>();
  const cargaPersonaDia = new Map<string, number>();
  const cargaPersona = new Map<string, number>();
  const clavePD = (fecha: Iso, persona: string) => `${fecha}|${persona}`;

  function registrar(fecha: Iso, persona: string, n: number) {
    cargaDia.set(fecha, (cargaDia.get(fecha) ?? 0) + n);
    cargaPersonaDia.set(clavePD(fecha, persona), (cargaPersonaDia.get(clavePD(fecha, persona)) ?? 0) + n);
    cargaPersona.set(persona, (cargaPersona.get(persona) ?? 0) + n);
  }
  for (const c of cargaBase) {
    if (receptoresSet.has(c.responsable)) registrar(c.fecha, c.responsable, c.total);
  }

  const ordenados = [...items].sort((a, b) => {
    const aFija = a.contacto.tipo === "FECHA";
    const bFija = b.contacto.tipo === "FECHA";
    if (aFija !== bFija) return aFija ? -1 : 1;
    if (a.contacto.tipo === "FECHA" && b.contacto.tipo === "FECHA") {
      const porFecha = a.contacto.fecha.localeCompare(b.contacto.fecha);
      if (porFecha !== 0) return porFecha;
    }
    return a.clave.localeCompare(b.clave);
  });

  const resultado: Asignacion[] = [];
  for (const item of ordenados) {
    let indiceDia: number;
    if (item.contacto.tipo === "FECHA") {
      const nominal = item.contacto.fecha < hoy ? hoy : item.contacto.fecha;
      let centro = dias.findIndex((d) => d >= nominal);
      if (centro === -1) centro = dias.length - 1;
      const desde = Math.max(0, centro - TOLERANCIA_DIAS_HABILES);
      const hasta = Math.min(dias.length - 1, centro + TOLERANCIA_DIAS_HABILES);
      indiceDia = centro;
      for (let i = desde; i <= hasta; i++) {
        const cargaI = cargaDia.get(dias[i]) ?? 0;
        const cargaMejor = cargaDia.get(dias[indiceDia]) ?? 0;
        if (cargaI < cargaMejor || (cargaI === cargaMejor && Math.abs(i - centro) < Math.abs(indiceDia - centro))) {
          indiceDia = i;
        }
      }
    } else {
      indiceDia = 0;
      for (let i = 1; i < dias.length; i++) {
        if ((cargaDia.get(dias[i]) ?? 0) < (cargaDia.get(dias[indiceDia]) ?? 0)) indiceDia = i;
      }
    }
    const fecha = dias[indiceDia];

    const cargaDe = (persona: string) => cargaPersonaDia.get(clavePD(fecha, persona)) ?? 0;
    const minimo = Math.min(...receptores.map(cargaDe));
    let responsable: string | undefined;
    if (item.ultimoResponsable && receptoresSet.has(item.ultimoResponsable) && cargaDe(item.ultimoResponsable) === minimo) {
      responsable = item.ultimoResponsable;
    } else {
      responsable = receptores
        .filter((p) => cargaDe(p) === minimo)
        .sort((a, b) => (cargaPersona.get(a) ?? 0) - (cargaPersona.get(b) ?? 0) || a.localeCompare(b))[0];
    }

    registrar(fecha, responsable, 1);
    resultado.push({ clave: item.clave, fecha, responsable });
  }
  return resultado;
}

export function periodoAnterior(periodo: string): string {
  return periodoDe(sumarMeses(`${periodo}-01`, -1));
}
