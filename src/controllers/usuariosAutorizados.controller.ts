import type { Request, Response } from "express";
import * as usuarioAutorizadoRepository from "../repositories/usuarioAutorizado.repository.js";
import type { RolUsuario } from "../types/usuarioAutorizado.js";

const ROLES_VALIDOS: RolUsuario[] = ["ADMIN", "ADMINISTRATIVO", "POSTVENTA"];

export async function listUsuariosAutorizados(_req: Request, res: Response) {
  const data = await usuarioAutorizadoRepository.listAll();
  res.status(200).json({ data });
}

export async function createUsuarioAutorizado(req: Request, res: Response) {
  const { usuarioExterno, idUsuarioApiworking, nombreVisible, rol, activo } = req.body ?? {};

  if (!usuarioExterno || !nombreVisible || !rol) {
    return res
      .status(400)
      .json({ message: "usuarioExterno, nombreVisible y rol son requeridos" });
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ message: "rol invalido" });
  }

  const existente = await usuarioAutorizadoRepository.findByUsuarioExterno(String(usuarioExterno));
  if (existente) {
    return res.status(409).json({ message: "Ese usuario externo ya esta registrado" });
  }

  const creado = await usuarioAutorizadoRepository.create({
    usuarioExterno: String(usuarioExterno),
    idUsuarioApiworking: idUsuarioApiworking ? String(idUsuarioApiworking) : null,
    nombreVisible: String(nombreVisible),
    rol,
    activo: activo === undefined ? true : Boolean(activo),
    creadoPor: req.usuario as string,
  });
  res.status(201).json(creado);
}

export async function updateUsuarioAutorizado(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: "id invalido" });
  }
  const actual = await usuarioAutorizadoRepository.findById(id);
  if (!actual) {
    return res.status(404).json({ message: "Usuario autorizado no encontrado" });
  }

  const { nombreVisible, rol, activo, recibeReparto, idUsuarioApiworking } = req.body ?? {};
  if (rol !== undefined && !ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ message: "rol invalido" });
  }

  // Salvaguarda (agregada, no pedida explicitamente): nunca dejar la
  // plataforma sin ningun ADMIN activo.
  const dejariaDeSerAdminActivo =
    actual.rol === "ADMIN" &&
    actual.activo &&
    ((rol !== undefined && rol !== "ADMIN") || activo === false);
  if (dejariaDeSerAdminActivo) {
    const otrosAdminsActivos = await usuarioAutorizadoRepository.countActiveAdmins(id);
    if (otrosAdminsActivos === 0) {
      return res.status(400).json({
        message: "No puedes desactivar ni cambiar de rol al ultimo ADMIN activo.",
      });
    }
  }

  const actualizado = await usuarioAutorizadoRepository.update(id, {
    nombreVisible: nombreVisible !== undefined ? String(nombreVisible) : undefined,
    rol: rol !== undefined ? rol : undefined,
    activo: activo !== undefined ? Boolean(activo) : undefined,
    recibeReparto: recibeReparto !== undefined ? Boolean(recibeReparto) : undefined,
    idUsuarioApiworking:
      idUsuarioApiworking !== undefined ? String(idUsuarioApiworking) : undefined,
    actualizadoPor: req.usuario as string,
  });
  res.status(200).json(actualizado);
}
