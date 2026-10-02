import * as bolsaRepository from "../../repositories/bolsa.repository.js";
import * as eventoOperativoRepository from "../../repositories/eventoOperativo.repository.js";
import * as oportunidadesEstadoRepository from "../../repositories/oportunidadesEstado.repository.js";
import type { BolsaResumen } from "../../types/postventa.js";

// Calculo 100% en vivo, nunca persistido — la ventana [desde, hasta] es la
// de la sesion real (abiertaEn..cerradaEn o ahora si sigue abierta), asi
// que dos sesiones el mismo dia (multiples aperturas, pedido explicito)
// nunca se mezclan entre si ni con dias anteriores.
export async function calcularResumen(
  usuario: string,
  sesionId: number | null,
  desde: string,
  hasta: string
): Promise<BolsaResumen> {
  const [contactosPorTipo, oportunidadesGanadas, conversiones] = await Promise.all([
    eventoOperativoRepository.contarPorTipoEnRango(
      usuario,
      ["CONTACTO_LLAMADA", "CONTACTO_WHATSAPP", "TAREA_COMPLETADA"],
      desde,
      hasta
    ),
    oportunidadesEstadoRepository.ganadasEnRango(usuario, desde, hasta),
    sesionId !== null ? bolsaRepository.listConversionesPorSesion(sesionId) : Promise.resolve([]),
  ]);

  const contactos =
    (contactosPorTipo.get("CONTACTO_LLAMADA") ?? 0) + (contactosPorTipo.get("CONTACTO_WHATSAPP") ?? 0);
  const misionesCompletadas = contactosPorTipo.get("TAREA_COMPLETADA") ?? 0;
  // totalSoles suma montos DECLARADOS (ver oportunidadesEstado.montoDeclarado)
  // — nunca una cifra de caja verificada.
  const totalSoles = oportunidadesGanadas.reduce((suma, g) => suma + g.montoTotal, 0);

  return {
    contactos,
    misionesCompletadas,
    oportunidadesGanadas,
    totalSoles,
    conversiones,
  };
}

export const RESUMEN_VACIO: BolsaResumen = {
  contactos: 0,
  misionesCompletadas: 0,
  oportunidadesGanadas: [],
  totalSoles: 0,
  conversiones: [],
};
