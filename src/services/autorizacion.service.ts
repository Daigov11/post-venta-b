import * as usuarioAutorizadoRepository from "../repositories/usuarioAutorizado.repository.js";
import type { UsuarioAutorizado } from "../types/usuarioAutorizado.js";

export const MENSAJE_NO_AUTORIZADO =
  "No tienes acceso autorizado a Plataforma Postventa. Contacta a un administrador.";

export interface ResultadoAutorizacion {
  autorizado: boolean;
  usuario: UsuarioAutorizado | null;
}

// Punto UNICO de verdad para "este usuario externo puede usar Postventa".
// Se llama SIEMPRE contra la base (sin cache/TTL): la regla "al desactivar
// un usuario, invalidar su acceso en la siguiente peticion" exige que cada
// llamada vea el estado actual, no uno cacheado. Usado desde requireAuth,
// login y /auth/me para no duplicar la logica en tres lugares.
export async function resolverAutorizacion(usuarioExterno: string): Promise<ResultadoAutorizacion> {
  const usuario = await usuarioAutorizadoRepository.findByUsuarioExterno(usuarioExterno);
  if (!usuario || !usuario.activo) {
    return { autorizado: false, usuario };
  }
  return { autorizado: true, usuario };
}
