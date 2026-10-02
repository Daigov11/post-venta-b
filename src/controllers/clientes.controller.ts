import type { Request, Response } from "express";
import { evaluateAlertas } from "../engines/alertas.engine.js";
import { aplicarEstadosGuardados, evaluateOportunidades } from "../engines/oportunidades.engine.js";
import { construirAlertasReuniones } from "./alertas.controller.js";
import type { ClientesFilter, ClientesSortField, Granularidad } from "../query/clientesQuery.js";
import { queryClientes } from "../query/clientesQuery.js";
import * as alertasEstadoRepository from "../repositories/alertasEstado.repository.js";
import * as clienteInteresesRepository from "../repositories/clienteIntereses.repository.js";
import * as clienteMetadataRepository from "../repositories/clienteMetadata.repository.js";
import * as interesesCatalogoRepository from "../repositories/interesesCatalogo.repository.js";
import * as notasRepository from "../repositories/notas.repository.js";
import * as oportunidadesEstadoRepository from "../repositories/oportunidadesEstado.repository.js";
import * as recuperacionEpisodioRepository from "../repositories/recuperacionEpisodio.repository.js";
import * as reunionesRepository from "../repositories/reuniones.repository.js";
import * as seguimientoRepository from "../repositories/seguimientoPostVenta.repository.js";
import * as tareasRepository from "../repositories/tareas.repository.js";
import { getConfig } from "../services/postventa/configService.js";
import { getClientesExcluidos, getPostVentaDataset } from "../services/postventa/postventaCache.js";
import { construirResumen } from "../services/postventa/seguimientoPostVenta.js";
import type { EstadoAlerta, EstadoPostVenta, Periodicidad, SeguimientoResumen } from "../types/postventa.js";

const EXPORT_MAX_ROWS = 5000;
const SORT_FIELDS: ClientesSortField[] = [
  "nombreCliente",
  "deudaTotal",
  "antiguedadMeses",
  "cantidadComprobantesHistorico",
  "estadoPostVentaEfectivo",
  "fechaOs",
  "fechaInicioCliente",
  "vencidoDesde",
  "diasParaRenovacion",
  "ingresosClienteMensual",
  "diasSinActividad",
];

function parseBoolean(value: unknown): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parseNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

const GRANULARIDADES: Granularidad[] = ["dia", "semana", "mes", "anio"];

function parsePeriodo(
  granularidadValue: unknown,
  referenciaValue: unknown
): { granularidad: Granularidad; referencia: string } | undefined {
  if (!GRANULARIDADES.includes(String(granularidadValue) as Granularidad)) return undefined;
  const granularidad = String(granularidadValue) as Granularidad;
  const referencia = referenciaValue ? new Date(String(referenciaValue)) : new Date();
  if (Number.isNaN(referencia.getTime())) return undefined;
  return { granularidad, referencia: referencia.toISOString() };
}

function buildFilter(query: Request["query"]): ClientesFilter {
  return {
    search: query.search ? String(query.search) : undefined,
    estado: query.estado ? (String(query.estado) as EstadoPostVenta) : undefined,
    plan: query.plan ? String(query.plan) : undefined,
    periodicidad: query.periodicidad ? (String(query.periodicidad) as Periodicidad) : undefined,
    ejecutivo: query.ejecutivo ? String(query.ejecutivo) : undefined,
    tipoOS: query.tipoOS ? String(query.tipoOS) : undefined,
    distribuidor: query.distribuidor ? String(query.distribuidor) : undefined,
    conDeuda: parseBoolean(query.conDeuda),
    conEquipo: parseBoolean(query.conEquipo),
    documentacionCompleta: parseBoolean(query.documentacionCompleta),
    departamento: query.departamento ? String(query.departamento) : undefined,
    antiguedadMesesMin: parseNumber(query.antiguedadMesesMin),
    antiguedadMesesMax: parseNumber(query.antiguedadMesesMax),
    comprobantesMin: parseNumber(query.comprobantesMin),
    comprobantesMax: parseNumber(query.comprobantesMax),
    ingresosMensualesMin: parseNumber(query.ingresosMensualesMin),
    ingresosMensualesMax: parseNumber(query.ingresosMensualesMax),
    segmento: query.segmento ? String(query.segmento) : undefined,
    renovacionProxima: parseBoolean(query.renovacionProxima),
    sinActividadReciente: parseBoolean(query.sinActividadReciente),
    nEstadoApiWorkingRaw: query.nEstadoApiWorkingRaw ? String(query.nEstadoApiWorkingRaw) : undefined,
    nuevoPeriodo: parsePeriodo(query.nuevoGranularidad, query.nuevoReferencia),
    suspendidoPeriodo: parsePeriodo(query.suspendidoGranularidad, query.suspendidoReferencia),
  };
}

export async function listClientes(req: Request, res: Response) {
  const dataset = await getPostVentaDataset();
  const filter = buildFilter(req.query);
  const sortByRaw = req.query.sortBy ? String(req.query.sortBy) : undefined;
  const sortBy = SORT_FIELDS.includes(sortByRaw as ClientesSortField)
    ? (sortByRaw as ClientesSortField)
    : undefined;
  const sortDir = req.query.sortDir === "desc" ? "desc" : "asc";

  // Por defecto, Cartera solo muestra clientes cuya ordenVigente esta
  // realmente activa — un cliente cuya UNICA orden esta suspendida/de baja
  // (pickOrdenVigente no tiene otra opcion mas activa para elegir) queda
  // fuera salvo que se pida explicitamente incluirNoActivas=true. Ver
  // modulo Recuperacion — esas ordenes siguen siendo trackeables ahi.
  const incluirNoActivas = req.query.incluirNoActivas === "true";
  let clientesBase = dataset.clientes;
  if (!incluirNoActivas) {
    const config = await getConfig();
    const estadosNoVigentes = config["dataset.estados_no_vigentes"]
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    clientesBase = clientesBase.filter(
      (c) => !estadosNoVigentes.includes(c.ordenVigente.nEstadoApiWorking.trim().toUpperCase())
    );
  }

  const isExport = req.query.export === "true";
  const result = queryClientes(clientesBase, {
    filter,
    sortBy,
    sortDir,
    page: isExport ? 1 : parseNumber(req.query.page),
    pageSize: isExport ? EXPORT_MAX_ROWS : parseNumber(req.query.pageSize),
  });

  // Badge "N sistema(s) en recuperacion" — solo se calcula para la pagina
  // actual (10-25 filas), nunca para todo el dataset. Resta la propia
  // ordenVigente del conteo para no duplicar lo que la fila ya muestra.
  const numerosPagina = result.data.map((c) => c.numeroDocumentoCliente);
  const ordenesAbiertasMap = await recuperacionEpisodioRepository.listOrdenesAbiertasByClientes(numerosPagina);
  const dataConRecuperacion = result.data.map((cliente) => {
    const ordenes = ordenesAbiertasMap.get(cliente.numeroDocumentoCliente) ?? [];
    const otras = ordenes.filter((id) => id !== cliente.ordenVigente.idOrdenServicio);
    return { ...cliente, recuperacionAbiertaCount: otras.length };
  });

  res.status(200).json({ ...result, data: dataConRecuperacion, generatedAt: dataset.generatedAt });
}

export async function getFichaCliente(req: Request, res: Response) {
  const { numeroDocumentoCliente } = req.params;
  const dataset = await getPostVentaDataset();
  let cliente = dataset.clientes.find((c) => c.numeroDocumentoCliente === numeroDocumentoCliente);

  // No esta en el dataset normal (ej. "CLIENTE DE BAJA", ver
  // dataset.estados_excluidos) — se busca tambien ahi antes de dar 404.
  // Sigue teniendo sentido ver su ficha (agendar reunion de reactivacion,
  // marcar interes) aunque este dado de baja.
  if (!cliente) {
    const excluidos = await getClientesExcluidos();
    cliente = excluidos.find((c) => c.numeroDocumentoCliente === numeroDocumentoCliente);
  }

  if (!cliente) {
    return res.status(404).json({ message: "Cliente no encontrado" });
  }

  const config = await getConfig();
  const [notas, tareas, interesesCatalogo, interesesMarcados, reuniones] = await Promise.all([
    notasRepository.listByCliente(numeroDocumentoCliente),
    tareasRepository.list({ numeroDocumentoCliente }),
    interesesCatalogoRepository.listActivos(),
    clienteInteresesRepository.listInteresIdsByCliente(numeroDocumentoCliente),
    reunionesRepository.listByCliente(numeroDocumentoCliente),
  ]);
  const alertasReuniones = await construirAlertasReuniones([cliente], dataset.generatedAt);
  let alertas = [
    ...evaluateAlertas([cliente], config, dataset.generatedAt),
    ...alertasReuniones.filter((a) => a.cliente === numeroDocumentoCliente),
  ];
  // Mismo merge de estado manual (VISTA/RESUELTA) que /api/alertas — sin esto,
  // la ficha seguia mostrando una alerta ya resuelta como si siguiera activa.
  const alertasEstados = await alertasEstadoRepository.listByIds(alertas.map((a) => a.id));
  alertas = alertas
    .map((a) => {
      const override = alertasEstados.get(a.id);
      return override ? { ...a, estado: override.estado as EstadoAlerta } : a;
    })
    .filter((a) => a.estado !== "RESUELTA");
  let oportunidades = evaluateOportunidades([cliente], config, dataset.generatedAt);
  // Mismo merge de gestion manual que /api/oportunidades (ver
  // oportunidades.controller.ts) — sin esto, la ficha mostraba siempre
  // ABIERTA aunque ya se hubiera gestionado desde la pantalla de Oportunidades.
  const oportunidadesEstados = await oportunidadesEstadoRepository.listByIds(
    oportunidades.map((o) => o.id)
  );
  oportunidades = aplicarEstadosGuardados(oportunidades, oportunidadesEstados);

  // Resumen liviano (no el detalle completo, eso lo trae el drawer al abrirse
  // — evita pedirle el historial de incidencias a APIWorking en cada carga
  // de ficha) para saber si mostrar la seccion de Seguimiento Post Venta.
  let seguimientoPostVenta: SeguimientoResumen | null = null;
  const seguimientoCliente = await seguimientoRepository.findClienteByNumero(numeroDocumentoCliente);
  if (seguimientoCliente) {
    const etapas = await seguimientoRepository.findEtapasByCliente(seguimientoCliente.id);
    seguimientoPostVenta = construirResumen(
      cliente,
      etapas,
      seguimientoCliente.estadoPipeline,
      seguimientoCliente.origen,
      seguimientoCliente.fechaInicio,
      config
    );
  }

  res.status(200).json({
    cliente,
    notas,
    tareas,
    alertas,
    oportunidades,
    intereses: { catalogo: interesesCatalogo, marcados: interesesMarcados },
    reuniones,
    seguimientoPostVenta,
  });
}

export async function updateClienteMetadata(req: Request, res: Response) {
  const { numeroDocumentoCliente } = req.params;
  const { segmentoManual, estadoPostVentaManual, telefonoManual, etiquetas, observacionGeneral } =
    req.body ?? {};

  await clienteMetadataRepository.upsert(
    numeroDocumentoCliente,
    {
      segmentoManual: segmentoManual === undefined ? undefined : segmentoManual || null,
      estadoPostVentaManual:
        estadoPostVentaManual === undefined ? undefined : estadoPostVentaManual || null,
      telefonoManual: telefonoManual === undefined ? undefined : telefonoManual || null,
      etiquetas: Array.isArray(etiquetas) ? etiquetas : undefined,
      observacionGeneral: observacionGeneral === undefined ? undefined : observacionGeneral || null,
    },
    req.usuario as string
  );

  // No hace falta invalidar nada: getPostVentaDataset() re-enriquece con
  // MySQL fresco en cada llamada, asi que el cambio ya se ve en el proximo
  // request sin esperar al sync diario de APIWorking.
  res.status(200).json({ message: "Metadata actualizada" });
}
