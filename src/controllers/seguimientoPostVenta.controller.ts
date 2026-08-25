import type { Request, Response } from "express";
import * as notasRepository from "../repositories/notas.repository.js";
import * as seguimientoRepository from "../repositories/seguimientoPostVenta.repository.js";
import { getConfig } from "../services/postventa/configService.js";
import { getClientesExcluidos, getPostVentaDataset } from "../services/postventa/postventaCache.js";
import {
  buscarIncidenciasCliente,
  calcularEstadoPipelineFinal,
  calcularEtapaActual,
  construirResumen,
  sincronizarNuevosClientes,
} from "../services/postventa/seguimientoPostVenta.js";
import type { PostVentaCliente, SeguimientoResumen } from "../types/postventa.js";

async function buscarCliente(numeroDocumentoCliente: string): Promise<PostVentaCliente | null> {
  const dataset = await getPostVentaDataset();
  let cliente = dataset.clientes.find((c) => c.numeroDocumentoCliente === numeroDocumentoCliente);
  if (!cliente) {
    const excluidos = await getClientesExcluidos();
    cliente = excluidos.find((c) => c.numeroDocumentoCliente === numeroDocumentoCliente);
  }
  return cliente ?? null;
}

export async function listSeguimientoPostVenta(_req: Request, res: Response) {
  await sincronizarNuevosClientes();

  const [dataset, excluidos, clientesPipeline, config] = await Promise.all([
    getPostVentaDataset(),
    getClientesExcluidos(),
    seguimientoRepository.listClientes(),
    getConfig(),
  ]);

  const clienteMap = new Map<string, PostVentaCliente>();
  for (const c of dataset.clientes) clienteMap.set(c.numeroDocumentoCliente, c);
  for (const c of excluidos) if (!clienteMap.has(c.numeroDocumentoCliente)) clienteMap.set(c.numeroDocumentoCliente, c);

  const etapasMap = await seguimientoRepository.findEtapasByClientes(
    clientesPipeline.map((c) => c.id)
  );

  const resumenes: SeguimientoResumen[] = [];
  for (const sc of clientesPipeline) {
    const cliente = clienteMap.get(sc.numeroDocumentoCliente);
    if (!cliente) {
      console.warn(
        `seguimiento-postventa: ${sc.numeroDocumentoCliente} esta en el pipeline pero no se encontro en el dataset ni en excluidos`
      );
      continue;
    }
    const etapas = etapasMap.get(sc.id) ?? [];
    resumenes.push(
      construirResumen(cliente, etapas, sc.estadoPipeline, sc.origen, sc.fechaInicio, config)
    );
  }

  res.status(200).json({ data: resumenes, total: resumenes.length });
}

export async function getSeguimientoDetalle(req: Request, res: Response) {
  const { numeroDocumentoCliente } = req.params;
  const [cliente, seguimientoCliente, config] = await Promise.all([
    buscarCliente(numeroDocumentoCliente),
    seguimientoRepository.findClienteByNumero(numeroDocumentoCliente),
    getConfig(),
  ]);

  if (!cliente) return res.status(404).json({ message: "Cliente no encontrado" });
  if (!seguimientoCliente) {
    return res.status(404).json({ message: "El cliente no esta en el pipeline de seguimiento post venta" });
  }

  const [etapas, incidencias, notas] = await Promise.all([
    seguimientoRepository.findEtapasByCliente(seguimientoCliente.id),
    buscarIncidenciasCliente(cliente.ordenVigente.idOrdenServicio),
    notasRepository.listByCliente(numeroDocumentoCliente),
  ]);

  const etapaActual =
    seguimientoCliente.estadoPipeline === "EN_PROCESO" ? calcularEtapaActual(etapas, config) : null;

  res.status(200).json({
    cliente: seguimientoCliente,
    etapas,
    etapaActual,
    incidencias,
    notas,
  });
}

export async function upsertEtapaSeguimiento(req: Request, res: Response) {
  const { numeroDocumentoCliente, etapa: etapaRaw } = req.params;
  const etapa = Number(etapaRaw);
  if (![1, 2, 3].includes(etapa)) {
    return res.status(400).json({ message: "etapa debe ser 1, 2 o 3" });
  }

  const seguimientoCliente = await seguimientoRepository.findClienteByNumero(numeroDocumentoCliente);
  if (!seguimientoCliente) {
    return res.status(404).json({ message: "El cliente no esta en el pipeline de seguimiento post venta" });
  }

  const { fechaRealizado, medioComunicacion, estadoSeguimiento, resumen, solicitudCliente } =
    req.body ?? {};

  await seguimientoRepository.upsertEtapa({
    seguimientoClienteId: seguimientoCliente.id,
    etapa: etapa as 1 | 2 | 3,
    fechaRealizado: fechaRealizado || null,
    medioComunicacion: medioComunicacion || null,
    estadoSeguimiento: estadoSeguimiento || null,
    resumen: resumen || null,
    solicitudCliente: solicitudCliente || null,
    usuario: (req.usuario as string) ?? null,
  });

  if (etapa === 3) {
    const etapas = await seguimientoRepository.findEtapasByCliente(seguimientoCliente.id);
    const estadoFinal = calcularEstadoPipelineFinal(etapas);
    await seguimientoRepository.updateEstadoPipeline(numeroDocumentoCliente, estadoFinal);
  }

  const etapas = await seguimientoRepository.findEtapasByCliente(seguimientoCliente.id);
  res.status(200).json({ etapas });
}
