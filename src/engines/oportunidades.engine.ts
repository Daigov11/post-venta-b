import type { Oportunidad, PostVentaCliente, PostVentaConfigValues } from "../types/postventa.js";

export interface OportunidadRule {
  id: string;
  tipo: string;
  evaluate: (
    cliente: PostVentaCliente,
    config: PostVentaConfigValues
  ) => {
    titulo: string;
    mensaje: string;
    valorEstimado: number | "No determinado";
    idOrdenServicio: number | null;
  } | null;
}

export const oportunidadRules: OportunidadRule[] = [
  {
    id: "sin-equipo",
    tipo: "VENTA_EQUIPO",
    evaluate: (cliente) => {
      if (cliente.ordenVigente.existeEquipo) return null;
      return {
        titulo: "Oportunidad de venta de equipo",
        mensaje: "El cliente no tiene un equipo asociado a su orden de servicio vigente.",
        valorEstimado: "No determinado",
        idOrdenServicio: cliente.ordenVigente.idOrdenServicio,
      };
    },
  },
  {
    id: "migracion-periodicidad",
    tipo: "MIGRACION_PERIODICIDAD",
    // Sugiere migrar a un plan Anual cuando el cliente esta en un ciclo mas corto.
    evaluate: (cliente) => {
      const { periodicidad, precioAnualProyectado } = cliente.planActual;
      if (periodicidad === "ANUAL" || periodicidad === "DESCONOCIDO") return null;
      return {
        titulo: "Posible migración a plan Anual",
        mensaje: `Plan actual con periodicidad ${periodicidad.toLowerCase()}; podría ofrecerse migración a un plan Anual.`,
        valorEstimado: precioAnualProyectado,
        idOrdenServicio: cliente.ordenVigente.idOrdenServicio,
      };
    },
  },
  {
    id: "cliente-antiguo",
    tipo: "CLIENTE_ANTIGUO",
    evaluate: (cliente, config) => {
      const meses = cliente.antiguedad.meses;
      if (meses === null || meses < config["oportunidad.cliente_antiguo_meses_min"]) return null;
      return {
        titulo: "Cliente antiguo",
        mensaje: `Cliente con ${cliente.antiguedad.texto} de antigüedad — candidato a beneficios de fidelización.`,
        valorEstimado: "No determinado",
        idOrdenServicio: null,
      };
    },
  },
  {
    id: "alto-volumen-comprobantes",
    tipo: "ALTO_VOLUMEN",
    evaluate: (cliente, config) => {
      if (
        cliente.cantidadComprobantesHistorico <
        config["oportunidad.alto_volumen_comprobantes_min"]
      ) {
        return null;
      }
      return {
        titulo: "Alto volumen histórico de comprobantes",
        mensaje: `El cliente acumula ${cliente.cantidadComprobantesHistorico} comprobantes históricos — candidato a revisión de plan.`,
        valorEstimado: "No determinado",
        idOrdenServicio: cliente.ordenVigente.idOrdenServicio,
      };
    },
  },
];

export function evaluateOportunidades(
  clientes: PostVentaCliente[],
  config: PostVentaConfigValues,
  generatedAt: string
): Oportunidad[] {
  const oportunidades: Oportunidad[] = [];
  for (const cliente of clientes) {
    for (const rule of oportunidadRules) {
      const result = rule.evaluate(cliente, config);
      if (!result) continue;
      oportunidades.push({
        id: `${rule.id}:${cliente.numeroDocumentoCliente}:${result.idOrdenServicio ?? "cliente"}`,
        tipo: rule.tipo,
        titulo: result.titulo,
        mensaje: result.mensaje,
        cliente: cliente.numeroDocumentoCliente,
        nombreCliente: cliente.nombreCliente,
        sistemas: cliente.sistemas,
        idOrdenServicio: result.idOrdenServicio,
        valorEstimado: result.valorEstimado,
        fecha: generatedAt,
        origen: rule.id,
      });
    }
  }
  return oportunidades;
}
