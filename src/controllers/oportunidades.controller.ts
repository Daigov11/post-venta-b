import type { Request, Response } from "express";
import { evaluateOportunidades } from "../engines/oportunidades.engine.js";
import { getConfig } from "../services/postventa/configService.js";
import { getPostVentaDataset } from "../services/postventa/postventaCache.js";

export async function listOportunidades(req: Request, res: Response) {
  const dataset = await getPostVentaDataset();
  const config = await getConfig();
  let oportunidades = evaluateOportunidades(dataset.clientes, config, dataset.generatedAt);

  const tipo = req.query.tipo ? String(req.query.tipo) : undefined;
  const cliente = req.query.numeroDocumentoCliente
    ? String(req.query.numeroDocumentoCliente)
    : undefined;

  if (tipo) oportunidades = oportunidades.filter((o) => o.tipo === tipo);
  if (cliente) oportunidades = oportunidades.filter((o) => o.cliente === cliente);

  res.status(200).json({ data: oportunidades, generatedAt: dataset.generatedAt });
}
