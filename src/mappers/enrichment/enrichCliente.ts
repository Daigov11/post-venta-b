import type {
  ClienteBase,
  ClienteMetadata,
  OsRefNormalized,
  OsRefResumen,
  PostVentaCliente,
  PostVentaConfigValues,
  SystemUsersCache,
} from "../../types/postventa.js";
import { calcularAntiguedad } from "./antiguedad.js";
import { toIsoOrNull, parseDmyDate } from "./dateParsing.js";
import { calcularEstadoPostVenta } from "./estadoPostVenta.js";
import {
  ajustarAnclaConDiaCiclo,
  calcularIngresoMensualReal,
  calcularProximaRenovacionDesdeComprobante,
  calcularProximoVencimiento,
  calcularSegmentoCartera,
  calcularUltimoVencimiento,
  calcularVencidoDesde,
  estaEnVentanaRenovacion,
  MS_POR_DIA,
  parseDiaCicloMensual,
  usaUltimoComprobantePararRenovacion,
} from "./facturacion.js";
import { parsePlan } from "./plan.js";
import { parseRubro } from "./rubro.js";
import { calcularSistemas } from "./sistemas.js";
import { parseUbigeo } from "./ubigeo.js";

function toOsRefResumen(os: OsRefNormalized): OsRefResumen {
  return {
    idOrdenServicio: os.idOrdenServicio,
    numeroOs: os.numeroOs,
    fechaOs: os.fechaOs,
    fechaSistema: os.fechaSistema,
    nombrePlan: os.nombrePlan,
    nTipoPlan: os.nTipoPlan,
    tipoOS: os.tipoOS,
    tipoCodigo: os.tipoCodigo,
    idEstadoApiWorking: os.idEstadoApiWorking,
    nEstadoApiWorking: os.nEstadoApiWorking,
    deuda: os.deuda,
    deudaProyectada: os.deudaProyectada,
    existeEquipo: os.existeEquipo,
    idEquipo: os.idEquipo,
    documentacion: os.documentacion,
    facturas: os.facturas,
    cantidadComprobantes: os.cantidadComprobantes,
    distribuidor: os.distribuidor,
    facturable: os.facturable,
    linkSistema: os.linkSistema,
    ejecutivo: os.ejecutivo,
    pagos: os.pagos,
    postVentaExtra: os.postVentaExtra,
  };
}

export interface LocalClienteContext {
  metadata: ClienteMetadata | null;
  notasCount: number;
  tareasAbiertasCount: number;
  tareasTotalCount: number;
  systemUsersCache: SystemUsersCache | null;
  // No es realmente "local" (MySQL) — viene del pull masivo de incidencias
  // de APIWorking, pero se pasa por el mismo bag por conveniencia. Ver
  // senalesIncidenciasMap en postventaCache.ts.
  altaPendiente: boolean;
  certificadoPorVencer: boolean;
  certificadoVenceHoy: boolean;
}

export function enrichCliente(
  base: ClienteBase,
  config: PostVentaConfigValues,
  local: LocalClienteContext,
  generatedAt: string
): PostVentaCliente {
  const estadoPostVenta = calcularEstadoPostVenta(base, config);
  const estadoPostVentaManual = local.metadata?.estadoPostVentaManual ?? null;
  const ordenVigenteResumen = toOsRefResumen(base.ordenVigente);
  const planActual = parsePlan(base.ordenVigente.nombrePlan, base.ordenVigente.nTipoPlan);

  const fechaSistemaVigente = base.ordenVigente.fechaSistema
    ? new Date(base.ordenVigente.fechaSistema)
    : null;

  // Para Mensual, el dia real de facturacion viene de nCicloFacturacion
  // (Administrativo/post-venta) cuando esta disponible — mas confiable que el
  // dia en que se registro la OS (fechaSistema), que puede no coincidir con
  // el dia de cobro real (caso real: OS registrada un dia del mes, ciclo
  // declarado "01 de cada mes"). Trimestral/Semestral/Anual no traen un dia
  // utilizable en ese campo (viene el nombre de la periodicidad, no un dia),
  // asi que siguen anclados en fechaSistema sin cambios.
  let fechaCicloAncla = fechaSistemaVigente;
  if (fechaCicloAncla && planActual.periodicidad === "MENSUAL") {
    const diaCiclo = parseDiaCicloMensual(base.ordenVigente.postVentaExtra?.nCicloFacturacion);
    if (diaCiclo !== null) {
      fechaCicloAncla = ajustarAnclaConDiaCiclo(fechaCicloAncla, diaCiclo);
    }
  }

  const ultimoVencimientoPago = fechaCicloAncla
    ? calcularUltimoVencimiento(fechaCicloAncla, planActual.periodicidad, new Date(generatedAt))
    : null;
  const segmentoCalculado = calcularSegmentoCartera(
    base.ordenVigente.pagos,
    fechaCicloAncla,
    planActual.periodicidad,
    ultimoVencimientoPago,
    config
  );
  const segmentoManual = local.metadata?.segmentoManual ?? null;

  // Para Semestral/Anual, fechaSistema resulto estar muy lejos del ciclo real
  // (76% de casos difieren, hasta 290 dias) — la renovacion se ancla al
  // ultimo comprobante real cuando existe. Esto NO toca el Segmento de
  // cartera (sigue con fechaCicloAncla/fechaSistema mas abajo): puntualidad
  // de pago necesita un calendario independiente del propio comprobante que
  // esta evaluando. Trimestral queda con fechaCicloAncla, sin cambios.
  let proximaRenovacion: Date | null = null;
  if (usaUltimoComprobantePararRenovacion(planActual.periodicidad)) {
    proximaRenovacion = calcularProximaRenovacionDesdeComprobante(
      base.ordenVigente.pagos,
      planActual.periodicidad,
      new Date(generatedAt)
    );
  }
  if (proximaRenovacion === null && fechaCicloAncla) {
    proximaRenovacion = calcularProximoVencimiento(
      fechaCicloAncla,
      planActual.periodicidad,
      new Date(generatedAt)
    );
  }
  const diasParaRenovacion = proximaRenovacion
    ? Math.ceil((proximaRenovacion.getTime() - new Date(generatedAt).getTime()) / MS_POR_DIA)
    : null;
  const renovacionEnAlerta = estaEnVentanaRenovacion(
    diasParaRenovacion,
    planActual.periodicidad,
    config
  );

  const vencidoDesde = calcularVencidoDesde(
    base.ordenVigente.pagos,
    fechaCicloAncla,
    planActual.periodicidad,
    ultimoVencimientoPago
  );
  const diasVencido = vencidoDesde
    ? Math.floor((new Date(generatedAt).getTime() - vencidoDesde.getTime()) / MS_POR_DIA)
    : null;

  const ingresoMensualReal = calcularIngresoMensualReal(base.ordenVigente.pagos, planActual.periodicidad);

  // fechaInactivo (Administrativo/post-venta) se actualiza constantemente en
  // clientes que usan el sistema con normalidad — no es "se dio de baja",
  // funciona como proxy de ultima actividad. null si no hay dato (nunca se
  // inventa; ver alertas.engine.ts para el umbral configurable).
  const fechaInactivo = base.ordenVigente.postVentaExtra?.fechaInactivo ?? null;
  const diasSinActividad = fechaInactivo
    ? Math.floor((new Date(generatedAt).getTime() - new Date(fechaInactivo).getTime()) / MS_POR_DIA)
    : null;
  const sinActividadReciente =
    diasSinActividad !== null && diasSinActividad > config["actividad.dias_sin_uso_alerta"];

  const telefonoManual = local.metadata?.telefonoManual ?? null;
  const osRefs = base.osRefs.map(toOsRefResumen);

  return {
    numeroDocumentoCliente: base.numeroDocumentoCliente,
    nombreCliente: base.nombreCliente,
    sistemas: calcularSistemas(osRefs),
    telefono: base.telefono,
    telefonoManual,
    telefonoEfectivo: telefonoManual ?? base.telefono,
    ubicacion: parseUbigeo(base.nUbigeo),

    ordenVigente: ordenVigenteResumen,
    planActual: {
      nombre: base.ordenVigente.nombrePlan,
      ...planActual,
    },

    osRefs,
    cantidadOs: base.osRefs.length,

    deudaTotal: base.deudaTotal,
    fechaInicioCliente: toIsoOrNull(parseDmyDate(base.pruebaFechaInicio)),
    antiguedad: calcularAntiguedad(base.pruebaFechaInicio),
    documentacionGlobal: ordenVigenteResumen.documentacion,
    cantidadComprobantesHistorico: ordenVigenteResumen.cantidadComprobantes,

    ultimoVencimientoPago: toIsoOrNull(ultimoVencimientoPago),
    proximaRenovacion: toIsoOrNull(proximaRenovacion),
    diasParaRenovacion,
    renovacionEnAlerta,
    vencidoDesde: toIsoOrNull(vencidoDesde),
    diasVencido,
    ingresoMensualReal,

    estadoPostVenta,
    estadoPostVentaManual,
    estadoPostVentaEfectivo: estadoPostVentaManual ?? estadoPostVenta,

    segmentoManual,
    segmentoCalculado,
    segmentoEfectivo: segmentoManual ?? segmentoCalculado,
    etiquetas: local.metadata?.etiquetas ?? [],
    observacionGeneral: local.metadata?.observacionGeneral ?? null,

    rubro: parseRubro({
      nSistema: base.ordenVigente.postVentaExtra?.nSistema,
      baseDatos: local.systemUsersCache?.baseDatos,
      linkSistema: base.ordenVigente.linkSistema,
      nombrePlan: base.ordenVigente.nombrePlan,
    }),
    cantidadTrabajadores: local.systemUsersCache?.cantidadTrabajadores ?? null,
    cantidadTrabajadoresActualizadoEn: local.systemUsersCache?.updatedAt ?? null,
    usuarios: local.systemUsersCache?.usuarios ?? [],
    baseDatos: local.systemUsersCache?.baseDatos ?? null,
    diasSinActividad,
    sinActividadReciente,
    altaPendiente: local.altaPendiente,
    certificadoPorVencer: local.certificadoPorVencer,
    certificadoVenceHoy: local.certificadoVenceHoy,

    metadata: {
      notasCount: local.notasCount,
      tareasAbiertasCount: local.tareasAbiertasCount,
      tareasTotalCount: local.tareasTotalCount,
      alertasCount: { INFO: 0, WARNING: 0, CRITICAL: 0 },
    },

    generatedAt,
  };
}
