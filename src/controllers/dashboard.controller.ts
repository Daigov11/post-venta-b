import type { Request, Response } from "express";
import { evaluateAlertas } from "../engines/alertas.engine.js";
import { evaluateOportunidades } from "../engines/oportunidades.engine.js";
import { getConfig } from "../services/postventa/configService.js";
import { getPostVentaDataset } from "../services/postventa/postventaCache.js";
import type { PostVentaCliente } from "../types/postventa.js";

function countBy<T>(items: T[], keyFn: (item: T) => string | null): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function topN(counts: Record<string, number>, n: number, labelKey: string) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ [labelKey]: key, count }));
}

// ---------------------------------------------------------------------------
// KPIs financiero-operativos del Panel principal (Fase 1 Postventa).
// Misma formula que ya usa frontend/src/pages/Renovaciones.tsx (esProblema/
// esDeEsteMes/resumenMesCliente) — se replica aca en vez de inventar un
// calculo distinto para el mismo concepto de "esperado"/"cobrado".
// ---------------------------------------------------------------------------

function esClienteEnProblema(cliente: PostVentaCliente): boolean {
  return (
    cliente.segmentoEfectivo === "CRITICO" ||
    cliente.ordenVigente.nEstadoApiWorking.trim().toUpperCase() === "SUSPENDIDO POR PAGO"
  );
}

// getFullYear/getMonth/getDate leen en la hora LOCAL del proceso, no UTC —
// correcto para "hoy"/"este mes" en Peru solo porque server.ts ya garantiza
// TZ=America/Lima (fijado por el script npm y con fallback defensivo
// `if (!process.env.TZ) process.env.TZ = "America/Lima"` para arranques que
// no pasen por "npm run"). Auditado 2026-09: confirmado, no se duplica esa
// garantia aca — si algun dia el proceso arranca sin ese fallback, todos los
// KPIs de este archivo (y los calculos de ciclo de facturacion del resto del
// backend) quedarian corridos al huso horario del servidor.
function esMismoMes(iso: string | null, ref: Date): boolean {
  if (!iso) return false;
  const f = new Date(iso);
  return f.getFullYear() === ref.getFullYear() && f.getMonth() === ref.getMonth();
}

function esMismoDia(iso: string | null, ref: Date): boolean {
  if (!iso) return false;
  const f = new Date(iso);
  return (
    f.getFullYear() === ref.getFullYear() &&
    f.getMonth() === ref.getMonth() &&
    f.getDate() === ref.getDate()
  );
}

interface KpisPanel {
  totalEsperadoMes: number;
  estimadoRecaudarHoy: number;
  totalCobradoMes: number;
  deudaPorAntiguedad: { unMes: number; dosMeses: number; tresMasMeses: number };
  clientesLoyalty: number;
  renovacionesProximas: { count: number; monto: number };
}

// clientesLoyalty y renovacionesProximas usan campos ya confirmados
// (sistemas.apiLoyalty, renovacionEnAlerta) — no hay campo real de "clientes
// Google" ni "Pago QR" en ningun lado del dataset (buscado en todo el repo),
// por eso no se calculan aca: el frontend los muestra como "Fuente pendiente
// de validacion" en vez de inventar un valor.
function calcularKpisPanel(clientes: PostVentaCliente[], ahora: Date): KpisPanel {
  let totalEsperadoMes = 0;
  let estimadoRecaudarHoy = 0;
  let totalCobradoMes = 0;
  let deudaUnMes = 0;
  let deudaDosMeses = 0;
  let deudaTresMasMeses = 0;
  let clientesLoyalty = 0;
  let renovacionesProximasCount = 0;
  let renovacionesProximasMonto = 0;

  for (const cliente of clientes) {
    if (cliente.sistemas.apiLoyalty) clientesLoyalty += 1;

    if (cliente.renovacionEnAlerta) {
      renovacionesProximasCount += 1;
      renovacionesProximasMonto += cliente.ingresoMensualReal ?? 0;
    }

    if (!esClienteEnProblema(cliente)) {
      if (esMismoMes(cliente.proximaRenovacion, ahora)) {
        totalEsperadoMes += cliente.ingresoMensualReal ?? 0;
      }
      if (esMismoDia(cliente.proximaRenovacion, ahora)) {
        estimadoRecaudarHoy += cliente.ingresoMensualReal ?? 0;
      }
    }

    // "Cobrado" = pago.total - pago.deuda por cada comprobante emitido este
    // mes, sumado. pago.deuda documentado como "> 0 = todavia impago" (ver
    // PagoNormalizado en types/postventa.ts) — total menos lo impago es lo
    // efectivamente cobrado de ESE comprobante, incluye pagos parciales.
    // Auditoria 2026-09: no existe una formula de "cobrado" agregado previa
    // en el codigo (Renovaciones.tsx solo clasifica cada comprobante como
    // PAGADO/DEBE segun si deuda>0, nunca suma un total cobrado) — esta es
    // una derivacion nueva sobre dos campos ya confirmados, no una formula
    // pre-validada por el negocio. Recomendado confirmar con el equipo antes
    // de reportarla fuera de este panel interno.
    for (const pago of cliente.ordenVigente.pagos) {
      if (esMismoMes(pago.fechaEmitido, ahora)) {
        totalCobradoMes += pago.total - pago.deuda;
      }
    }

    // Antiguedad de deuda en baldes de 30/60 dias sobre diasVencido (campo ya
    // confirmado) — aproxima "1/2/3+ meses" por dias corridos, no por mes
    // calendario exacto (ej. dia 31 cae en el mismo balde que dia 30). Es la
    // lectura mas directa del pedido original ("agrupado por antiguedad: 1
    // mes/2 meses/3 meses o mas"), sin un umbral de dias ya definido por el
    // negocio que reemplazar.
    if (cliente.deudaTotal > 0 && cliente.diasVencido !== null) {
      if (cliente.diasVencido <= 30) deudaUnMes += cliente.deudaTotal;
      else if (cliente.diasVencido <= 60) deudaDosMeses += cliente.deudaTotal;
      else deudaTresMasMeses += cliente.deudaTotal;
    }
  }

  return {
    totalEsperadoMes,
    estimadoRecaudarHoy,
    totalCobradoMes,
    deudaPorAntiguedad: { unMes: deudaUnMes, dosMeses: deudaDosMeses, tresMasMeses: deudaTresMasMeses },
    clientesLoyalty,
    renovacionesProximas: { count: renovacionesProximasCount, monto: renovacionesProximasMonto },
  };
}

export async function getKpis(_req: Request, res: Response) {
  const dataset = await getPostVentaDataset();
  const config = await getConfig();
  const clientes = dataset.clientes;

  const clientesPorEstado = { NORMAL: 0, REVISAR: 0, ATENCION: 0 };
  let deudaTotal = 0;
  let clientesConDeuda = 0;
  let clientesSinEquipo = 0;
  let clientesDocumentacionIncompleta = 0;
  let comprobantesHistoricoTotal = 0;

  for (const cliente of clientes) {
    clientesPorEstado[cliente.estadoPostVentaEfectivo] += 1;
    deudaTotal += cliente.deudaTotal;
    if (cliente.deudaTotal > 0) clientesConDeuda += 1;
    if (!cliente.ordenVigente.existeEquipo) clientesSinEquipo += 1;
    if (cliente.documentacionGlobal.porcentaje < 100) clientesDocumentacionIncompleta += 1;
    comprobantesHistoricoTotal += cliente.cantidadComprobantesHistorico;
  }

  const clientesPorEstadoApiWorkingCounts = countBy(
    clientes,
    (c: PostVentaCliente) => c.ordenVigente.nEstadoApiWorking || null
  );
  const clientesPorPeriodicidadCounts: Record<string, number> = {
    MENSUAL: 0,
    TRIMESTRAL: 0,
    SEMESTRAL: 0,
    ANUAL: 0,
    DESCONOCIDO: 0,
  };
  for (const cliente of clientes) {
    clientesPorPeriodicidadCounts[cliente.planActual.periodicidad] += 1;
  }
  const clientesPorEjecutivoCounts = countBy(
    clientes,
    (c: PostVentaCliente) => c.ordenVigente.ejecutivo
  );
  const clientesPorTipoOsCounts = countBy(
    clientes,
    (c: PostVentaCliente) => c.ordenVigente.tipoOS || null
  );
  const topPlanesCounts = countBy(clientes, (c: PostVentaCliente) => c.planActual.nombre);
  const distribucionDepartamentosCounts = countBy(clientes, (c: PostVentaCliente) => {
    const ubicacion = c.ubicacion;
    return ubicacion && "departamento" in ubicacion ? ubicacion.departamento : null;
  });

  const alertas = evaluateAlertas(clientes, config, dataset.generatedAt);
  const alertasPorNivel = { INFO: 0, WARNING: 0, CRITICAL: 0 };
  for (const alerta of alertas) alertasPorNivel[alerta.nivel] += 1;

  const oportunidades = evaluateOportunidades(clientes, config, dataset.generatedAt);
  const oportunidadesPorTipo = countBy(oportunidades, (o) => o.tipo);

  const kpisPanel = calcularKpisPanel(clientes, new Date());

  res.status(200).json({
    generatedAt: dataset.generatedAt,
    totalClientes: clientes.length,
    totalOs: dataset.totalOsRows,
    deudaTotal,
    clientesConDeuda,
    clientesSinEquipo,
    clientesDocumentacionIncompleta,
    comprobantesHistoricoTotal,
    clientesPorEstado,
    clientesPorEstadoApiWorking: topN(clientesPorEstadoApiWorkingCounts, 10, "estado"),
    clientesPorPeriodicidad: clientesPorPeriodicidadCounts,
    clientesPorEjecutivo: topN(clientesPorEjecutivoCounts, 10, "ejecutivo"),
    clientesPorTipoOs: topN(clientesPorTipoOsCounts, 10, "tipo"),
    topPlanes: topN(topPlanesCounts, 8, "plan"),
    distribucionDepartamentos: topN(distribucionDepartamentosCounts, 10, "departamento"),
    alertasPorNivel,
    oportunidadesPorTipo,
    ...kpisPanel,
  });
}
