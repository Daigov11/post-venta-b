import type { Request, Response } from "express";
import { aplicarEstadosGuardados, evaluateOportunidades } from "../engines/oportunidades.engine.js";
import * as eventoOperativoRepository from "../repositories/eventoOperativo.repository.js";
import * as oportunidadesEstadoRepository from "../repositories/oportunidadesEstado.repository.js";
import { getConfig } from "../services/postventa/configService.js";
import { getPostVentaDataset } from "../services/postventa/postventaCache.js";
import type { EstadoOportunidad } from "../types/postventa.js";

const ESTADOS_VALIDOS: EstadoOportunidad[] = ["ABIERTA", "EN_GESTION", "GANADA", "PERDIDA"];

export async function listOportunidades(req: Request, res: Response) {
  const dataset = await getPostVentaDataset();
  const config = await getConfig();
  let oportunidades = evaluateOportunidades(dataset.clientes, config, dataset.generatedAt);

  // Las oportunidades no se guardan — se recalculan en cada request. Lo unico
  // persistido es la gestion manual (estado/responsable/siguiente accion/
  // resultado) en postventa_oportunidades_estado, indexada por el mismo id
  // deterministico que genera el motor. Mismo patron que /api/alertas.
  const estados = await oportunidadesEstadoRepository.listByIds(oportunidades.map((o) => o.id));
  oportunidades = aplicarEstadosGuardados(oportunidades, estados);

  const tipo = req.query.tipo ? String(req.query.tipo) : undefined;
  const cliente = req.query.numeroDocumentoCliente
    ? String(req.query.numeroDocumentoCliente)
    : undefined;
  const estadoFiltro = req.query.estado ? String(req.query.estado) : undefined;

  if (tipo) oportunidades = oportunidades.filter((o) => o.tipo === tipo);
  if (cliente) oportunidades = oportunidades.filter((o) => o.cliente === cliente);
  if (estadoFiltro) oportunidades = oportunidades.filter((o) => o.estado === estadoFiltro);

  res.status(200).json({ data: oportunidades, generatedAt: dataset.generatedAt });
}

export async function actualizarEstadoOportunidad(req: Request, res: Response) {
  const { id } = req.params;
  const { estado, responsable, siguienteAccion, resultado, numeroDocumentoCliente, tipo, montoDeclarado } =
    req.body ?? {};

  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ message: `estado debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}` });
  }
  if (!numeroDocumentoCliente) {
    return res.status(400).json({ message: "numeroDocumentoCliente es requerido" });
  }
  // montoDeclarado (antes "montoReal") solo tiene sentido junto a
  // estado=GANADA (ver "La Bolsa") — el frontend ya calculo/pidio este
  // numero (valorEstimado real, o lo que la persona escribio a mano cuando
  // el motor no trae uno). Es lo que alguien DECLARA, nunca una cifra de
  // caja verificada — no se concilia contra ningun pago real de APIWorking.
  if (
    montoDeclarado !== undefined &&
    montoDeclarado !== null &&
    (typeof montoDeclarado !== "number" || montoDeclarado < 0)
  ) {
    return res.status(400).json({ message: "montoDeclarado debe ser un número mayor o igual a 0" });
  }

  const updated = await oportunidadesEstadoRepository.upsert({
    oportunidadId: id,
    numeroDocumentoCliente: String(numeroDocumentoCliente),
    estado,
    responsable: responsable ? String(responsable) : null,
    siguienteAccion: siguienteAccion ? String(siguienteAccion) : null,
    resultado: resultado ? String(resultado) : null,
    usuario: req.usuario as string,
    tipo: tipo ? String(tipo) : null,
    montoDeclarado: typeof montoDeclarado === "number" ? montoDeclarado : null,
  });

  await eventoOperativoRepository.registrarSeguro({
    usuario: req.usuario as string,
    tipoAccion: "OPORTUNIDAD_GESTIONADA",
    modulo: "OPORTUNIDADES",
    numeroDocumentoCliente: String(numeroDocumentoCliente),
    entidadTipo: "OPORTUNIDAD",
    entidadId: id,
    detalle: `Estado: ${estado}`,
  });

  res.status(200).json(updated);
}
