import { evaluateAlertas } from "../../engines/alertas.engine.js";
import { groupOrdenesByCliente } from "../../mappers/cliente.aggregator.js";
import { enrichCliente } from "../../mappers/enrichment/enrichCliente.js";
import { mapOrdenServicioToOsRef } from "../../mappers/ordenServicio.mapper.js";
import { indexarPostVentaPorOrdenServicio } from "../../mappers/postVenta.mapper.js";
import { env } from "../../config/env.js";
import * as clienteMetadataRepository from "../../repositories/clienteMetadata.repository.js";
import * as notasRepository from "../../repositories/notas.repository.js";
import * as snapshotsRepository from "../../repositories/snapshotsDiarios.repository.js";
import * as systemUsersCacheRepository from "../../repositories/systemUsersCache.repository.js";
import * as tareasRepository from "../../repositories/tareas.repository.js";
import type { ClienteBase, PostVentaDataset } from "../../types/postventa.js";
import { fetchAllOrdenesServicio } from "../apiworking/ordenesSync.js";
import { fetchAllPostVenta } from "../apiworking/postVentaSync.js";
import { getConfig } from "./configService.js";

// ---------------------------------------------------------------------------
// Dataset compartido, no por usuario. La parte cara (traer todo de APIWorking)
// se hace UNA vez para toda la app (sync diario programado + boton manual),
// no una vez por sesion de cada ejecutivo — ver services/postventa/scheduler.ts.
//
// Se separa en dos capas:
//  - "raw": el pull de APIWorking ya mapeado/agrupado por cliente, sin la
//    parte local (notas, tareas, metadata, segmento). Cara, se refresca 1 vez
//    al dia.
//  - getPostVentaDataset(): re-enriquece esa capa raw con lo local de MySQL
//    en CADA llamada — es barato (unas pocas queries + calculo en memoria
//    sobre ~2000-3000 registros), asi que una nota o un segmento manual que
//    alguien acaba de guardar se ve al instante, sin esperar al proximo sync.
// ---------------------------------------------------------------------------

interface RawState {
  clienteBases: ClienteBase[];
  generatedAt: string;
}

let rawState: RawState | null = null;
let refreshPromise: Promise<RawState> | null = null;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseEstadosExcluidos(raw: string): string[] {
  return raw
    .split(",")
    .map((estado) => estado.trim().toUpperCase())
    .filter(Boolean);
}

async function fetchRawState(): Promise<RawState> {
  const token = env.fallbackApiToken;
  if (!token) {
    throw new Error(
      "FALLBACK_API_TOKEN no esta configurado — es la credencial que usa el sync compartido para hablar con APIWorking."
    );
  }

  const config = await getConfig();
  const hoy = todayIsoDate();

  // Se traen en paralelo: son dos endpoints independientes de APIWorking, ni
  // uno depende del resultado del otro.
  const [rawRows, postVentaRows] = await Promise.all([
    fetchAllOrdenesServicio(token, {
      fechaInicio: config["sync.fecha_inicio"],
      fechaFin: hoy,
    }),
    fetchAllPostVenta(token, {
      f1: config["sync.post_venta_fecha_inicio"],
      f2: hoy,
    }),
  ]);

  const postVentaIndex = indexarPostVentaPorOrdenServicio(postVentaRows);
  const osRefs = rawRows.map((raw) =>
    mapOrdenServicioToOsRef(raw, postVentaIndex.get(raw.idOrdenServicio) ?? null)
  );
  const clienteBases = groupOrdenesByCliente(osRefs);

  return { clienteBases, generatedAt: new Date().toISOString() };
}

// Fuerza a traer todo de nuevo desde APIWorking. Comparte la misma promesa si
// ya hay un refresh en vuelo (evita pulls duplicados si el scheduler y un
// click manual coinciden).
export async function refreshRawDataset(): Promise<void> {
  if (refreshPromise) {
    await refreshPromise;
    return;
  }
  refreshPromise = fetchRawState().finally(() => {
    refreshPromise = null;
  });
  rawState = await refreshPromise;
}

// Re-enriquece la capa raw actual con datos locales frescos de MySQL. Si
// todavia no hubo ningun sync (arranque del server), espera el primero.
export async function getPostVentaDataset(): Promise<PostVentaDataset> {
  if (!rawState) {
    await refreshRawDataset();
  }
  const { clienteBases: clienteBasesSinFiltrar, generatedAt: rawGeneratedAt } = rawState!;

  const config = await getConfig();
  const estadosExcluidos = parseEstadosExcluidos(config["dataset.estados_excluidos"]);
  const clienteBases = clienteBasesSinFiltrar.filter(
    (base) => !estadosExcluidos.includes(base.ordenVigente.nEstadoApiWorking.trim().toUpperCase())
  );
  const numerosDocumento = clienteBases.map((base) => base.numeroDocumentoCliente);

  const [metadataMap, notasCountMap, tareasCountMap, systemUsersCacheMap] = await Promise.all([
    clienteMetadataRepository.findAllByClientes(numerosDocumento),
    notasRepository.countByClientes(numerosDocumento),
    tareasRepository.countAbiertasYTotalByClientes(numerosDocumento),
    systemUsersCacheRepository.findAllByClientes(numerosDocumento),
  ]);

  const clientes = clienteBases.map((base) => {
    const tareasCounts = tareasCountMap.get(base.numeroDocumentoCliente);
    return enrichCliente(
      base,
      config,
      {
        metadata: metadataMap.get(base.numeroDocumentoCliente) ?? null,
        notasCount: notasCountMap.get(base.numeroDocumentoCliente) ?? 0,
        tareasAbiertasCount: tareasCounts?.abiertas ?? 0,
        tareasTotalCount: tareasCounts?.total ?? 0,
        systemUsersCache: systemUsersCacheMap.get(base.numeroDocumentoCliente) ?? null,
      },
      rawGeneratedAt
    );
  });

  // Backfill del resumen de alertas por cliente (metadata.alertasCount) usando
  // el mismo motor que expone GET /api/alertas — evita duplicar la logica de
  // reglas, y es una operacion en memoria, no una llamada de red adicional.
  const alertas = evaluateAlertas(clientes, config, rawGeneratedAt);
  const alertasPorCliente = new Map<string, { INFO: number; WARNING: number; CRITICAL: number }>();
  for (const alerta of alertas) {
    const counts = alertasPorCliente.get(alerta.cliente) ?? { INFO: 0, WARNING: 0, CRITICAL: 0 };
    counts[alerta.nivel] += 1;
    alertasPorCliente.set(alerta.cliente, counts);
  }
  for (const cliente of clientes) {
    const counts = alertasPorCliente.get(cliente.numeroDocumentoCliente);
    if (counts) cliente.metadata.alertasCount = counts;
  }

  return {
    clientes,
    generatedAt: rawGeneratedAt,
    totalOsRows: clienteBases.reduce((sum, base) => sum + base.osRefs.length, 0),
  };
}

// Sync completo: trae todo de nuevo de APIWorking, re-enriquece, y guarda la
// foto diaria para historial propio (tiempo en estado, evolucion de deuda y
// segmento). Lo llama el scheduler una vez al dia y el boton manual "Actualizar
// datos".
export async function runDailySync(): Promise<PostVentaDataset> {
  await refreshRawDataset();
  const dataset = await getPostVentaDataset();

  try {
    await snapshotsRepository.guardarSnapshots(
      dataset.clientes.map((c) => ({
        numeroDocumentoCliente: c.numeroDocumentoCliente,
        idOrdenServicio: c.ordenVigente.idOrdenServicio,
        nEstadoApiWorking: c.ordenVigente.nEstadoApiWorking,
        deudaTotal: c.deudaTotal,
        segmentoCalculado: c.segmentoCalculado,
      })),
      todayIsoDate()
    );
  } catch (error) {
    console.error("No se pudo guardar el snapshot diario:", error);
  }

  return dataset;
}
