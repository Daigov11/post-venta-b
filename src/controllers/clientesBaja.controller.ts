import type { Request, Response } from "express";
import type { Granularidad } from "../query/clientesQuery.js";
import { rangoDePeriodo } from "../query/clientesQuery.js";
import * as bajaCacheRepository from "../repositories/bajaCache.repository.js";
import * as bajaHistoricoRepository from "../repositories/bajaHistorico.repository.js";
import { buscarFechaBaja } from "../services/postventa/bajaSeguimiento.js";
import { getClientesExcluidos } from "../services/postventa/postventaCache.js";
import { runWithConcurrency } from "../utils/concurrency.js";

const CONCURRENCY = 5;
const GRANULARIDADES: Granularidad[] = ["dia", "semana", "mes", "anio"];

function parseNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function parsePeriodo(
  granularidadValue: unknown,
  referenciaValue: unknown
): { granularidad: Granularidad; referencia: string } | undefined {
  if (!GRANULARIDADES.includes(String(granularidadValue) as Granularidad)) return undefined;
  const referencia = referenciaValue ? new Date(String(referenciaValue)) : new Date();
  if (Number.isNaN(referencia.getTime())) return undefined;
  return { granularidad: String(granularidadValue) as Granularidad, referencia: referencia.toISOString() };
}

// Clientes con nEstadoApiWorking en dataset.estados_excluidos (hoy: "CLIENTE
// DE BAJA"), paginados. La fecha de baja no esta guardada en ningun lado —
// se busca en el historial de seguimiento (1 llamada por cliente) SOLO para
// los que aparecen en la pagina actual y todavia no estan en cache; una vez
// buscada queda guardada en postventa_baja_cache, asi que las vistas
// siguientes de esa misma pagina son instantaneas. Nunca se piden las 1000+
// de una — ver postventa_baja_cache.
export async function listClientesBaja(req: Request, res: Response) {
  const pageRaw = parseNumber(req.query.page);
  const page = pageRaw && pageRaw > 0 ? pageRaw : 1;
  const pageSizeRaw = parseNumber(req.query.pageSize);
  const pageSize = pageSizeRaw && pageSizeRaw > 0 ? pageSizeRaw : 20;
  const orden = req.query.orden === "antiguo" ? "antiguo" : "reciente";
  const periodo = parsePeriodo(req.query.granularidad, req.query.referencia);
  const search = req.query.search ? String(req.query.search).trim().toLowerCase() : "";

  const excluidosSinFiltrar = await getClientesExcluidos();
  const excluidos = search
    ? excluidosSinFiltrar.filter(
        (c) =>
          c.nombreCliente.toLowerCase().includes(search) ||
          c.numeroDocumentoCliente.toLowerCase().includes(search)
      )
    : excluidosSinFiltrar;
  const numeros = excluidos.map((c) => c.numeroDocumentoCliente);
  const cacheMap = await bajaCacheRepository.findAllByClientes(numeros);

  const conFecha = excluidos.map((cliente) => ({
    cliente,
    fechaBaja: cacheMap.get(cliente.numeroDocumentoCliente)?.fechaBaja ?? null,
    enCache: cacheMap.has(cliente.numeroDocumentoCliente),
  }));

  // Con filtro de periodo solo se puede confiar en lo que ya esta en cache —
  // no se buscan las fechas de los 1000+ clientes de golpe. Los que todavia
  // no se verificaron quedan afuera del filtrado (ver pendientesVerificar).
  let coleccion = conFecha;
  let pendientesVerificar: number | undefined;
  if (periodo) {
    const { inicio, fin } = rangoDePeriodo(periodo.granularidad, new Date(periodo.referencia));
    pendientesVerificar = conFecha.filter((item) => !item.enCache).length;
    coleccion = conFecha.filter((item) => {
      if (!item.enCache || !item.fechaBaja) return false;
      const fecha = new Date(item.fechaBaja);
      return fecha >= inicio && fecha < fin;
    });
  }

  // Conocidos primero (segun "orden"); los que todavia no se buscaron van al
  // final por nombre — se reordenan solos a medida que se cachean.
  const dirFecha = orden === "antiguo" ? 1 : -1;
  coleccion.sort((a, b) => {
    if (a.fechaBaja && b.fechaBaja) return dirFecha * a.fechaBaja.localeCompare(b.fechaBaja);
    if (a.fechaBaja) return -1;
    if (b.fechaBaja) return 1;
    return a.cliente.nombreCliente.localeCompare(b.cliente.nombreCliente);
  });

  const total = coleccion.length;
  const start = (page - 1) * pageSize;
  const pageItems = coleccion.slice(start, start + pageSize);

  const porBuscar = pageItems.filter((item) => !item.enCache);
  await runWithConcurrency(porBuscar, CONCURRENCY, async (item) => {
    try {
      const fechaBaja = await buscarFechaBaja(item.cliente.ordenVigente.idOrdenServicio);
      await bajaCacheRepository.upsert({
        numeroDocumentoCliente: item.cliente.numeroDocumentoCliente,
        idOrdenServicio: item.cliente.ordenVigente.idOrdenServicio,
        fechaBaja,
      });
      item.fechaBaja = fechaBaja;
    } catch (error) {
      console.error(
        `No se pudo buscar fecha de baja para ${item.cliente.numeroDocumentoCliente}:`,
        error
      );
    }
  });

  const historicoMap = await bajaHistoricoRepository.findAllByClientes(
    pageItems.map((item) => item.cliente.numeroDocumentoCliente)
  );

  res.status(200).json({
    data: pageItems.map((item) => ({
      numeroDocumentoCliente: item.cliente.numeroDocumentoCliente,
      nombreCliente: item.cliente.nombreCliente,
      sistemas: item.cliente.sistemas,
      planActual: item.cliente.planActual,
      deudaTotal: item.cliente.deudaTotal,
      ejecutivo: item.cliente.ordenVigente.ejecutivo,
      fechaBaja: item.fechaBaja,
      historico: historicoMap.get(item.cliente.numeroDocumentoCliente) ?? null,
    })),
    page,
    pageSize,
    total,
    pendientesVerificar,
  });
}
