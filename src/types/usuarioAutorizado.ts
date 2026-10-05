export type RolUsuario = "ADMIN" | "ADMINISTRATIVO" | "POSTVENTA";

export interface UsuarioAutorizado {
  id: number;
  idUsuarioApiworking: string | null;
  usuarioExterno: string;
  nombreVisible: string;
  rol: RolUsuario;
  activo: boolean;
  // Recibe tareas del reparto diario de contactos (cualquier rol; ver 0047).
  recibeReparto: boolean;
  ultimoAccesoEn: string | null;
  creadoEn: string;
  actualizadoEn: string;
  creadoPor: string;
  actualizadoPor: string | null;
}
