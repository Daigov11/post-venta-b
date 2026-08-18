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
  });
}
