import type {
  PagoNormalizado,
  Periodicidad,
  PostVentaConfigValues,
  SegmentoCartera,
} from "../../types/postventa.js";

const PERIODICIDAD_MESES: Record<Exclude<Periodicidad, "DESCONOCIDO">, number> = {
  MENSUAL: 1,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

// nCicloFacturacion (Administrativo/post-venta) solo trae un dia de
// facturacion real para planes MENSUAL — formato confirmado con datos reales:
// "01 de cada mes", "22 de cada mes", "12 de cada mes". Para Trimestral/
// Semestral/Anual el campo trae el nombre de la periodicidad en vez de un
// dia ("SEMESTRAL", "ANUAL", etc.), y algunos mensuales traen "Facturar el
// mes consumido" (sin dia identificable) — en esos casos no hay nada que
// parsear, se sigue usando fechaSistema. Nunca se inventa un dia.
const CICLO_MENSUAL_RE = /^(\d{1,2})\s+de\s+cada\s+mes$/i;

export function parseDiaCicloMensual(nCicloFacturacion: string | null | undefined): number | null {
  if (!nCicloFacturacion) return null;
  const match = CICLO_MENSUAL_RE.exec(nCicloFacturacion.trim());
  if (!match) return null;
  const dia = Number(match[1]);
  return dia >= 1 && dia <= 31 ? dia : null;
}

// Corrige el dia de fechaSistema para que coincida con el dia de facturacion
// real declarado por APIWorking (nCicloFacturacion), en vez de asumir que el
// dia en que se registro la OS es el dia de cobro — pueden no coincidir (ver
// caso real: OS registrada un dia, ciclo declarado el "01 de cada mes").
// Mes/anio se mantienen de fechaSistema, solo se ajusta el dia.
export function ajustarAnclaConDiaCiclo(fechaSistema: Date, diaCiclo: number): Date {
  const ajustada = new Date(fechaSistema);
  ajustada.setDate(diaCiclo);
  return ajustada;
}

// fechaSistema es el ancla de facturacion (fecha de registro de la OS); el
// vencimiento de cada ciclo es fechaSistema + N * periodicidad, de forma
// recurrente. Devuelve el vencimiento mas reciente que ya paso — el periodo
// que corresponde evaluar ahora para saber si el cliente pago a tiempo.
// null si el cliente todavia no llega a su primer vencimiento (cliente nuevo).
export function calcularUltimoVencimiento(
  fechaSistema: Date,
  periodicidad: Periodicidad,
  hoy: Date = new Date()
): Date | null {
  if (periodicidad === "DESCONOCIDO") return null;
  const meses = PERIODICIDAD_MESES[periodicidad];

  const vencimiento = new Date(fechaSistema);
  vencimiento.setMonth(vencimiento.getMonth() + meses);

  let ultimoVencido: Date | null = null;
  while (vencimiento.getTime() <= hoy.getTime()) {
    ultimoVencido = new Date(vencimiento);
    vencimiento.setMonth(vencimiento.getMonth() + meses);
  }
  return ultimoVencido;
}

// Mismo ancla y ciclo que calcularUltimoVencimiento, pero proyectado hacia
// adelante: el primer vencimiento que todavia no paso. Es la "renovacion" del
// spec — APIWorking no tiene una fecha de renovacion de contrato separada, se
// deriva del mismo ciclo de facturacion que ya usamos para el segmento.
export function calcularProximoVencimiento(
  fechaSistema: Date,
  periodicidad: Periodicidad,
  hoy: Date = new Date()
): Date | null {
  if (periodicidad === "DESCONOCIDO") return null;
  const meses = PERIODICIDAD_MESES[periodicidad];

  const vencimiento = new Date(fechaSistema);
  vencimiento.setMonth(vencimiento.getMonth() + meses);
  while (vencimiento.getTime() <= hoy.getTime()) {
    vencimiento.setMonth(vencimiento.getMonth() + meses);
  }
  return vencimiento;
}

export const MS_POR_DIA = 1000 * 60 * 60 * 24;

// Periodicidades para las que la renovacion se ancla al ultimo comprobante
// real en vez de a fechaSistema — ver calcularProximaRenovacionDesdeComprobante.
// Trimestral queda deliberadamente afuera (decision del negocio: se mantiene
// con la logica de fechaSistema por ahora).
const PERIODICIDADES_ANCLADAS_A_COMPROBANTE = new Set<Periodicidad>(["SEMESTRAL", "ANUAL"]);

export function usaUltimoComprobantePararRenovacion(periodicidad: Periodicidad): boolean {
  return PERIODICIDADES_ANCLADAS_A_COMPROBANTE.has(periodicidad);
}

type RenovacionConfigKey =
  | "renovacion.alerta_mensual_dias"
  | "renovacion.alerta_trimestral_dias"
  | "renovacion.alerta_semestral_dias"
  | "renovacion.alerta_anual_dias";

const RENOVACION_CONFIG_KEY: Record<Exclude<Periodicidad, "DESCONOCIDO">, RenovacionConfigKey> = {
  MENSUAL: "renovacion.alerta_mensual_dias",
  TRIMESTRAL: "renovacion.alerta_trimestral_dias",
  SEMESTRAL: "renovacion.alerta_semestral_dias",
  ANUAL: "renovacion.alerta_anual_dias",
};

// Unica fuente de verdad para "esta dentro de la ventana de aviso de
// renovacion" — la usan tanto el filtro del cuadro de Clientes como la
// alerta RENOVACION_PROXIMA, para que ambos coincidan siempre.
export function estaEnVentanaRenovacion(
  diasParaRenovacion: number | null,
  periodicidad: Periodicidad,
  config: PostVentaConfigValues
): boolean {
  if (diasParaRenovacion === null || periodicidad === "DESCONOCIDO") return false;
  const umbral = config[RENOVACION_CONFIG_KEY[periodicidad]];
  return diasParaRenovacion >= 0 && diasParaRenovacion <= umbral;
}

function comprobanteMasReciente(
  pagos: PagoNormalizado[]
): (PagoNormalizado & { fechaEmitido: string }) | null {
  const pagosConFecha = pagos.filter(
    (p): p is PagoNormalizado & { fechaEmitido: string } => p.fechaEmitido !== null
  );
  if (pagosConFecha.length === 0) return null;
  return pagosConFecha.reduce((a, b) => (a.fechaEmitido > b.fechaEmitido ? a : b));
}

// "origen" del comprobante distingue el cargo real del ciclo (Plan/Anualidad)
// de cargos sueltos que no representan una renovacion — confirmado con datos
// reales: un cliente Anual mostraba su ultima factura como "Directo" S/50
// (un cargo aislado) en vez de su "Administrativo Anualidad" S/1,404.20 real,
// adelantando la fecha estimada por meses. Cubre 90% de Semestral y 82% de
// Anual — el resto no tiene ningun comprobante con este origen y cae al
// comprobante mas reciente sin filtrar (nunca se descarta un cliente entero
// por esto).
const ORIGENES_RENOVACION_REAL = new Set(["Administrativo Anualidad", "Administrativo Plan"]);

function comprobanteMasRecienteDeRenovacion(
  pagos: PagoNormalizado[]
): (PagoNormalizado & { fechaEmitido: string }) | null {
  const pagosConFecha = pagos.filter(
    (p): p is PagoNormalizado & { fechaEmitido: string } => p.fechaEmitido !== null
  );
  const relevantes = pagosConFecha.filter((p) => ORIGENES_RENOVACION_REAL.has(p.origen));
  const candidatos = relevantes.length > 0 ? relevantes : pagosConFecha;
  if (candidatos.length === 0) return null;
  return candidatos.reduce((a, b) => (a.fechaEmitido > b.fechaEmitido ? a : b));
}

// Para Semestral/Anual, fechaSistema (fecha de registro de la OS) resulto
// estar muy lejos del ciclo real de facturacion — confirmado con datos
// reales: 76% de semestrales y 76% de anuales difieren en mas de 3 dias
// contra lo que indica su ultimo comprobante, con casos de hasta 290 dias de
// diferencia. En vez de confiar en fechaSistema, se ancla la PROXIMA
// renovacion al ultimo comprobante REAL DE RENOVACION (origen "Administrativo
// Anualidad"/"Administrativo Plan", ver comprobanteMasRecienteDeRenovacion) +
// periodicidad (mismo mecanismo de "avanzar hasta el primer vencimiento
// futuro" que calcularProximoVencimiento, solo que arrancando desde una
// fecha mas confiable). No reemplaza el ancla que usa el Segmento de cartera
// (calcularSegmentoCartera sigue con fechaSistema — necesita un calendario
// independiente para medir si un pago llego tarde, no el mismo dato que se
// esta evaluando).
// null si nunca hubo un comprobante real — ahi no hay de donde anclar, cae al
// fallback de fechaSistema en el llamador (nunca se inventa una fecha).
export function calcularProximaRenovacionDesdeComprobante(
  pagos: PagoNormalizado[],
  periodicidad: Periodicidad,
  hoy: Date = new Date()
): Date | null {
  if (periodicidad === "DESCONOCIDO") return null;
  const masReciente = comprobanteMasRecienteDeRenovacion(pagos);
  if (!masReciente) return null;
  return calcularProximoVencimiento(new Date(masReciente.fechaEmitido), periodicidad, hoy);
}

// Desde que ciclo quedo un cliente sin pagar — distinto de
// ultimoVencimientoPago (que es puramente el ciclo calendario mas reciente,
// avanza aunque nunca haya llegado un comprobante real). Ancla al comprobante
// real mas reciente cuando existe: si esta impago, el ciclo que le
// corresponde a ESE comprobante es el que quedo sin cubrir — no
// necesariamente el ultimo ciclo calendario, porque una vez suspendido
// APIWorking deja de emitir comprobantes nuevos y ultimoVencimientoPago sigue
// avanzando solo (ver caso real: cliente con ultima factura impaga del
// 12-05, suspendido desde entonces, pero ultimoVencimientoPago ya marcaba
// julio porque el calendario no se detiene). null si el cliente esta al dia
// (nada que mostrar como "vencido").
export function calcularVencidoDesde(
  pagos: PagoNormalizado[],
  fechaSistema: Date | null,
  periodicidad: Periodicidad,
  ultimoVencimientoPago: Date | null
): Date | null {
  if (periodicidad === "DESCONOCIDO" || !fechaSistema || !ultimoVencimientoPago) return null;

  const masReciente = comprobanteMasReciente(pagos);
  if (!masReciente) return ultimoVencimientoPago; // nunca llego un comprobante para el ciclo vencido
  if (masReciente.deuda <= 0) return null; // al dia

  const fechaEmitido = new Date(masReciente.fechaEmitido);
  return calcularUltimoVencimiento(fechaSistema, periodicidad, fechaEmitido) ?? ultimoVencimientoPago;
}

// Ingreso mensual REAL, derivado del comprobante mas reciente en pagos[] —
// no del campo ingresosClienteMensual que devuelve Administrativo/post-venta,
// cuya formula APIWorking no documenta (podria ser un promedio, una
// proyeccion, o quedar desactualizado tras una suspension). Lo que un cliente
// factura/paga de verdad esta en su comprobante mas reciente (total, no
// deuda — el monto facturado, pague o no lo que debia). Se normaliza a un
// equivalente mensual segun la periodicidad del plan para que sea comparable
// entre clientes con distintos ciclos (ej. semestral de S/600 -> S/100/mes).
// null si no hay ningun comprobante o si la periodicidad es desconocida — no
// se puede normalizar a "mensual" sin inventar un supuesto sobre el ciclo.
export function calcularIngresoMensualReal(
  pagos: PagoNormalizado[],
  periodicidad: Periodicidad
): number | null {
  if (periodicidad === "DESCONOCIDO") return null;
  const masReciente = comprobanteMasReciente(pagos);
  if (!masReciente) return null;
  return masReciente.total / PERIODICIDAD_MESES[periodicidad];
}

// Segmento de cartera basado en puntualidad de pago:
//  - Cliente todavia no llega a su primer vencimiento -> Diamante (confirmado
//    con el negocio: no se penaliza a un cliente nuevo).
//  - Vencimiento ya paso pero no hay ningun comprobante -> Critico (nunca
//    facturaron/pagaron ese ciclo).
//  - Se toma el comprobante mas reciente (por fechaEmitido) de la OS vigente:
//      - si todavia tiene deuda pendiente -> Critico directo (coincide con
//        nEstado tipo "SUSPENDIDO POR PAGO").
//      - si esta pagado, se compara fechaEmitido contra el vencimiento del
//        ciclo al que corresponde esa factura -> dias de atraso -> tier.
export function calcularSegmentoCartera(
  pagos: PagoNormalizado[],
  fechaSistema: Date | null,
  periodicidad: Periodicidad,
  ultimoVencimientoPago: Date | null,
  config: PostVentaConfigValues
): SegmentoCartera | null {
  if (periodicidad === "DESCONOCIDO" || !fechaSistema) return null;
  if (!ultimoVencimientoPago) return "DIAMANTE";

  const masReciente = comprobanteMasReciente(pagos);
  if (!masReciente) return "CRITICO";
  if (masReciente.deuda > 0) return "CRITICO";

  const fechaEmitido = new Date(masReciente.fechaEmitido);
  const cicloDeEseComprobante = calcularUltimoVencimiento(fechaSistema, periodicidad, fechaEmitido);
  if (!cicloDeEseComprobante) return "DIAMANTE";

  const diasAtraso = Math.round(
    (fechaEmitido.getTime() - cicloDeEseComprobante.getTime()) / MS_POR_DIA
  );

  if (diasAtraso <= config["segmento.diamante_max_dias"]) return "DIAMANTE";
  if (diasAtraso <= config["segmento.oro_max_dias"]) return "ORO";
  if (diasAtraso <= config["segmento.plata_max_dias"]) return "PLATA";
  return "CRITICO";
}
