import type { Request, Response } from "express";
import * as eventoOperativoRepository from "../repositories/eventoOperativo.repository.js";
import type { TipoAccionOperativa } from "../types/postventa.js";

// Sin TZ fijo propio: reutiliza la misma nocion de "hoy" que ya usa
// resultadoDia.controller.ts (proceso corre con TZ=America/Lima, ver
// server.ts) para que el resumen de "hoy" coincida exactamente con el dia
// que ve Resultados y cierre diario.
function hoyLimaISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Solo lectura a proposito: no existe un POST generico de eventos operativos
// expuesto al frontend — cada tipo de evento se registra server-side, como
// efecto de una escritura real ya validada (crear tarea, resolver alerta,
// etc.), nunca como un valor libre que el cliente pueda inventar.
export async function listEventos(req: Request, res: Response) {
  const data = await eventoOperativoRepository.listPorFiltro({
    usuario: req.query.usuario ? String(req.query.usuario) : undefined,
    numeroDocumentoCliente: req.query.numeroDocumentoCliente
      ? String(req.query.numeroDocumentoCliente)
      : undefined,
    entidadTipo: req.query.entidadTipo ? String(req.query.entidadTipo) : undefined,
    entidadId: req.query.entidadId ? String(req.query.entidadId) : undefined,
    tipoAccion: req.query.tipoAccion ? (String(req.query.tipoAccion) as TipoAccionOperativa) : undefined,
    desde: req.query.desde ? String(req.query.desde) : undefined,
    hasta: req.query.hasta ? String(req.query.hasta) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.status(200).json({ data });
}

// "Mi resumen de hoy" — usuario siempre viene de la sesion (nunca de un
// query param), igual que GET /resultados/hoy, para que nadie pueda pedir el
// resumen de otro usuario disfrazado de "hoy".
export async function getResumenHoy(req: Request, res: Response) {
  const usuario = req.usuario as string;
  const fecha = hoyLimaISO();
  const resumenes = await eventoOperativoRepository.resumenPorUsuarioYRango({
    usuario,
    desde: fecha,
    hasta: fecha,
  });
  const resumen = resumenes[0] ?? { usuario, fecha, total: 0, porTipo: {} };
  res.status(200).json(resumen);
}

// Vista amplia (historico/admin) — usuario es un filtro opcional aca, a
// diferencia de getResumenHoy.
export async function getResumenRango(req: Request, res: Response) {
  const data = await eventoOperativoRepository.resumenPorUsuarioYRango({
    usuario: req.query.usuario ? String(req.query.usuario) : undefined,
    desde: req.query.desde ? String(req.query.desde) : undefined,
    hasta: req.query.hasta ? String(req.query.hasta) : undefined,
  });
  res.status(200).json({ data });
}
