export type RolUsuario = "ADMIN" | "ADMINISTRATIVO" | "POSTVENTA";

export interface UsuarioAutorizado {
  id: number;
  idUsuarioApiworking: string | null;
  usuarioExterno: string;
  nombreVisible: string;
  rol: RolUsuario;
  activo: boolean;
  ultimoAccesoEn: string | null;
  creadoEn: string;
  actualizadoEn: string;
  creadoPor: string;
  actualizadoPor: string | null;
}
