import {
  ajustarAnclaConDiaCiclo,
  calcularUltimoVencimiento,
  calcularVencidoDesde,
  parseDiaCicloMensual,
} from "../mappers/enrichment/facturacion.js";
import { parsePlan } from "../mappers/enrichment/plan.js";
import type { BajaCache } from "../repositories/bajaCache.repository.js";
import type {
  CandidatoRecuperacion,
  OsRefResumen,
  PostVentaCliente,
  PostVentaConfigValues,
} from "../types/postventa.js";

const ESTADO_SUSPENDIDO = "SUSPENDIDO POR PAGO";
const ESTADO_BAJA = "CLIENTE DE BAJA";

// "Vencido desde" (no "próxima renovación") es el concepto correcto para
// detectar impago: proximaRenovacion/calcularProximoVencimiento son
// SIEMPRE una fecha futura (proyectan el calendario hacia adelante sin
// importar si se pagó o no), sirven para la alerta "renovación próxima",
// no para saber si un ciclo ya vencido sigue sin cubrirse. Misma
// orquestacion (ancla + periodicidad + ultimoVencimiento + vencidoDesde)
// que ya usa enrichCliente.ts para la orden vigente, reutilizando
// EXACTAMENTE las mismas funciones puras de facturacion.ts (nunca se
// reimplementa el calculo financiero) — pero evaluada aca por cada orden de
// osRefs, no solo la vigente. enrichCliente.ts no se toca, cero riesgo a lo
// ya validado.
function calcularVencidoDesdeOrden(os: OsRefResumen, hoy: Date): Date | null {
  const { periodicidad } = parsePlan(os.nombrePlan, os.nTipoPlan);
  if (periodicidad === "DESCONOCIDO") return null;

  let ancla = os.fechaSistema ? new Date(os.fechaSistema) : null;
  if (!ancla) return null;
  if (periodicidad === "MENSUAL") {
    const diaCiclo = parseDiaCicloMensual(os.postVentaExtra?.nCicloFacturacion);
    if (diaCiclo !== null) ancla = ajustarAnclaConDiaCiclo(ancla, diaCiclo);
  }

  const ultimoVencimientoPago = calcularUltimoVencimiento(ancla, periodicidad, hoy);
  return calcularVencidoDesde(os.pagos, ancla, periodicidad, ultimoVencimientoPago);
}

function* iterarOrdenes(clientes: PostVentaCliente[]) {
  for (const cliente of clientes) {
    for (const os of cliente.osRefs) {
      yield { cliente, os };
    }
  }
}

// Detecta, por CADA orden (no por RUC), si califica hoy para alguna de las 3
// fuentes de recuperacion. Un mismo cliente puede aportar varios candidatos
// (una orden activa que no califica, y otra suspendida/de baja que si) — la
// clasificacion es por orden, nunca se colapsa al nivel de cliente.
// clientesActivos y clientesExcluidos son mutuamente excluyentes por RUC
// (ver pickOrdenVigente/getClientesExcluidos) asi que no hay doble conteo.
export function detectarCandidatos(
  clientesActivos: PostVentaCliente[],
  clientesExcluidos: PostVentaCliente[],
  bajaCacheMap: Map<string, BajaCache>,
  config: PostVentaConfigValues,
  hoy: Date = new Date(),
  incluirHistorico = false
): CandidatoRecuperacion[] {
  const candidatos: CandidatoRecuperacion[] = [];
  const corte = config["operativo.fecha_corte_historico"];
  const diasGracia = config["recuperacion.dias_gracia_renovacion"];

  for (const { cliente, os } of iterarOrdenes([...clientesActivos, ...clientesExcluidos])) {
    const estado = os.nEstadoApiWorking.trim().toUpperCase();

    // BAJA: fecha real solo si ya esta cacheada (postventa_baja_cache) — no
    // se dispara una busqueda cara de historial-seguimiento para toda la
    // cola en cada carga. El motivo nunca afirma "falta de pago": no existe
    // un campo estructurado real para eso (ver auditoria). El corte se
    // compara contra la fecha REAL del hecho (fecha_baja), nunca contra
    // fechaSistema (cuando empezo la relacion con el cliente) — un cliente
    // antiguo dado de baja la semana pasada es un caso vigente, no historico.
    // Sin fecha cacheada no hay como evaluar el corte: se admite igual pero
    // como PENDIENTE_VALIDACION (nunca como EN_RECUPERACION urgente), asi
    // que "inundar la cola" solo puede pasar en la bandeja de revision, no
    // en la cola con cuenta regresiva.
    if (estado === ESTADO_BAJA) {
      const cache = bajaCacheMap.get(cliente.numeroDocumentoCliente);
      const fechaBaja = cache?.fechaBaja ? cache.fechaBaja.slice(0, 10) : null;
      if (!incluirHistorico && fechaBaja !== null && fechaBaja < corte) continue;
      candidatos.push({
        idOrdenServicio: os.idOrdenServicio,
        numeroDocumentoCliente: cliente.numeroDocumentoCliente,
        nombreCliente: cliente.nombreCliente,
        origen: "BAJA",
        evidenciaConfirmada: fechaBaja !== null,
        motivo: fechaBaja
          ? `Baja registrada el ${fechaBaja} según historial — motivo no confirmado en el sistema.`
          : "Baja registrada en APIWorking — sin fecha ni motivo confirmados en el sistema.",
        monto: os.deuda,
      });
      continue;
    }

    // SUSPENSION: estado real y autoritativo (nEstadoApiWorking), pero no
    // existe ningun campo real de fecha de suspension — nunca se asume, y
    // por lo tanto tampoco hay fecha contra la cual aplicar el corte. Nace
    // PENDIENTE_VALIDACION siempre, asi que no genera presion de cola
    // urgente aunque el corte no pueda filtrarla.
    if (estado === ESTADO_SUSPENDIDO) {
      candidatos.push({
        idOrdenServicio: os.idOrdenServicio,
        numeroDocumentoCliente: cliente.numeroDocumentoCliente,
        nombreCliente: cliente.nombreCliente,
        origen: "SUSPENSION",
        evidenciaConfirmada: false,
        motivo: "Suspendido por pago en APIWorking — sin fecha de suspensión confirmada.",
        monto: os.deuda,
      });
      continue;
    }

    // RENOVACION_IMPAGA: unica fuente con fecha real y confiable de punta a
    // punta. El corte se compara contra la fecha del CICLO VENCIDO sin
    // pagar (el hecho real), nunca contra fechaSistema — mismo razonamiento
    // que BAJA arriba.
    const vencidoDesde = calcularVencidoDesdeOrden(os, hoy);
    if (!vencidoDesde) continue; // al dia, o sin ancla suficiente para calcular
    const fechaLimiteGracia = new Date(vencidoDesde);
    fechaLimiteGracia.setDate(fechaLimiteGracia.getDate() + diasGracia);
    if (hoy.getTime() <= fechaLimiteGracia.getTime()) continue; // todavia dentro del periodo de gracia
    const fechaVencidoIso = vencidoDesde.toISOString().slice(0, 10);
    if (!incluirHistorico && fechaVencidoIso < corte) continue;

    candidatos.push({
      idOrdenServicio: os.idOrdenServicio,
      numeroDocumentoCliente: cliente.numeroDocumentoCliente,
      nombreCliente: cliente.nombreCliente,
      origen: "RENOVACION_IMPAGA",
      evidenciaConfirmada: true,
      motivo: `Ciclo vencido desde el ${fechaVencidoIso}, sin pago tras ${diasGracia} dia(s) de gracia.`,
      monto: os.deuda,
    });
  }

  return candidatos;
}
