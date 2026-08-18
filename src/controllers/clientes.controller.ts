import type { Request, Response } from "express";
import { evaluateAlertas } from "../engines/alertas.engine.js";
import { evaluateOportunidades } from "../engines/oportunidades.engine.js";
import { construirAlertasReuniones } from "./alertas.controller.js";
import type { ClientesFilter, ClientesSortField } from "../query/clientesQuery.js";
import { queryClientes } from "../query/clientesQuery.js";
import * as clienteInteresesRepository from "../repositories/clienteIntereses.repository.js";
import * as clienteMetadataRepository from "../repositories/clienteMetadata.repository.js";
import * as interesesCatalogoRepository from "../repositories/interesesCatalogo.repository.js";
import * as notasRepository from "../repositories/notas.repository.js";
import * as reunionesRepository from "../repositories/reuniones.repository.js";
import * as tareasRepository from "../repositories/tareas.repository.js";
import { getConfig } from "../services/postventa/configService.js";
import { getPostVentaDataset } from "../services/postventa/postventaCache.js";
import type { EstadoPostVenta, Periodicidad } from "../types/postventa.js";

const EXPORT_MAX_ROWS = 5000;
const SORT_FIELDS: ClientesSortField[] = [
  "nombreCliente",
  "deudaTotal",
  "antiguedadMeses",
  "cantidadComprobantesHistorico",
  "estadoPostVentaEfectivo",
  "fechaOs",
  "diasParaRenovacion",
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
    segmento: query.segmento ? String(query.segmento) : undefined,
    renovacionProxima: parseBoolean(query.renovacionProxima),
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

  const isExport = req.query.export === "true";
  const result = queryClientes(dataset.clientes, {
    filter,
    sortBy,
    sortDir,
    page: isExport ? 1 : parseNumber(req.query.page),
    pageSize: isExport ? EXPORT_MAX_ROWS : parseNumber(req.query.pageSize),
  });

  res.status(200).json(result);
}

export async function getFichaCliente(req: Request, res: Response) {
  const { numeroDocumentoCliente } = req.params;
  const dataset = await getPostVentaDataset();
  const cliente = dataset.clientes.find(
    (c) => c.numeroDocumentoCliente === numeroDocumentoCliente
  );

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
  const alertas = [
    ...evaluateAlertas([cliente], config, dataset.generatedAt),
    ...alertasReuniones.filter((a) => a.cliente === numeroDocumentoCliente),
  ];
  const oportunidades = evaluateOportunidades([cliente], config, dataset.generatedAt);

  res.status(200).json({
    cliente,
    notas,
    tareas,
    alertas,
    oportunidades,
    intereses: { catalogo: interesesCatalogo, marcados: interesesMarcados },
    reuniones,
  });
}

export async function updateClienteMetadata(req: Request, res: Response) {
  const { numeroDocumentoCliente } = req.params;
  const { segmentoManual, estadoPostVentaManual, etiquetas, observacionGeneral } = req.body ?? {};

  await clienteMetadataRepository.upsert(
    numeroDocumentoCliente,
    {
      segmentoManual: segmentoManual === undefined ? undefined : segmentoManual || null,
      estadoPostVentaManual:
        estadoPostVentaManual === undefined ? undefined : estadoPostVentaManual || null,
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
