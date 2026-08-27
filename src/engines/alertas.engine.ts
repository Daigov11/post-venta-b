import type {
  Alerta,
  NivelAlerta,
  Periodicidad,
  PostVentaCliente,
  PostVentaConfigValues,
} from "../types/postventa.js";

const PERIODICIDAD_LABEL: Record<Exclude<Periodicidad, "DESCONOCIDO">, string> = {
  MENSUAL: "mensual",
  TRIMESTRAL: "trimestral",
  SEMESTRAL: "semestral",
  ANUAL: "anual",
};

export interface AlertaRule {
  id: string;
  tipo: string;
  nivel: NivelAlerta;
  evaluate: (
    cliente: PostVentaCliente,
    config: PostVentaConfigValues
  ) => { titulo: string; mensaje: string; idOrdenServicio: number | null } | null;
}

export const alertaRules: AlertaRule[] = [
  {
    id: "deuda-pendiente",
    tipo: "DEUDA_PENDIENTE",
    nivel: "CRITICAL",
    evaluate: (cliente, config) => {
      if (cliente.deudaTotal <= config["alerta.deuda_min"]) return null;
      return {
        titulo: "Deuda pendiente",
        mensaje: `El cliente tiene una deuda total de S/ ${cliente.deudaTotal.toFixed(2)}.`,
        idOrdenServicio: cliente.ordenVigente.idOrdenServicio,
      };
    },
  },
  {
    id: "sin-equipo",
    tipo: "SIN_EQUIPO",
    nivel: "WARNING",
    evaluate: (cliente) => {
      if (cliente.ordenVigente.existeEquipo) return null;
      return {
        titulo: "Cliente sin equipo",
        mensaje: "La orden de servicio vigente no tiene un equipo asociado.",
        idOrdenServicio: cliente.ordenVigente.idOrdenServicio,
      };
    },
  },
  {
    id: "documentacion-incompleta",
    tipo: "DOCUMENTACION_INCOMPLETA",
    nivel: "WARNING",
    evaluate: (cliente, config) => {
      if (cliente.documentacionGlobal.porcentaje >= config["estado.documentacion_completa_min"]) {
        return null;
      }
      return {
        titulo: "Documentación incompleta",
        mensaje: `Documentación al ${cliente.documentacionGlobal.porcentaje}% (${cliente.documentacionGlobal.disponibles}/${cliente.documentacionGlobal.total}).`,
        idOrdenServicio: cliente.ordenVigente.idOrdenServicio,
      };
    },
  },
  {
    id: "sin-comprobantes",
    tipo: "SIN_COMPROBANTES",
    nivel: "WARNING",
    evaluate: (cliente) => {
      if (!cliente.ordenVigente.facturable) return null;
      if (cliente.ordenVigente.cantidadComprobantes > 0) return null;
      return {
        titulo: "Sin comprobantes emitidos",
        mensaje: "El cliente es facturable pero no registra comprobantes históricos emitidos.",
        idOrdenServicio: cliente.ordenVigente.idOrdenServicio,
      };
    },
  },
  {
    id: "aniversario-antiguedad",
    tipo: "ANIVERSARIO",
    nivel: "INFO",
    evaluate: (cliente, config) => {
      const meses = cliente.antiguedad.meses;
      const ciclo = config["alerta.antiguedad_aniversario_meses"];
      if (meses === null || meses === 0 || ciclo <= 0) return null;
      if (meses % ciclo !== 0) return null;
      return {
        titulo: "Aniversario de antigüedad",
        mensaje: `El cliente cumple ${cliente.antiguedad.texto} como cliente.`,
        idOrdenServicio: null,
      };
    },
  },
  {
    id: "renovacion-proxima",
    tipo: "RENOVACION_PROXIMA",
    nivel: "WARNING",
    // "Renovacion" = proximo vencimiento del ciclo de pago (fechaSistema +
    // periodicidad, ver facturacion.ts) — APIWorking no tiene una fecha de
    // renovacion de contrato separada, es el mismo dato que ya usamos para el
    // segmento de cartera, solo que proyectado hacia adelante. Una vez que la
    // fecha ya paso sin pagar, el cliente cae a segmento CRITICO y/o dispara
    // la alerta de deuda pendiente — esta regla no se solapa con esas, solo
    // cubre la ventana de aviso previo. renovacionEnAlerta ya viene calculado
    // desde enrichCliente con el mismo criterio que usa el filtro del cuadro
    // de Clientes — una sola fuente de verdad para ambos.
    evaluate: (cliente) => {
      const dias = cliente.diasParaRenovacion;
      const periodicidad = cliente.planActual.periodicidad;
      if (!cliente.renovacionEnAlerta || dias === null || periodicidad === "DESCONOCIDO") return null;
      return {
        titulo: "Renovación próxima",
        mensaje: `Faltan ${dias} día(s) para el próximo vencimiento de pago (plan ${PERIODICIDAD_LABEL[periodicidad]}).`,
        idOrdenServicio: cliente.ordenVigente.idOrdenServicio,
      };
    },
  },
  {
    id: "sin-actividad-reciente",
    tipo: "SIN_ACTIVIDAD_RECIENTE",
    nivel: "WARNING",
    // postVentaExtra.fechaInactivo es la fecha de ultimo ingreso del cliente
    // a su sistema (confirmado por el negocio) — no es "se dio de baja".
    // Vale la pena mirar sobre todo cuando el segmento de pago dice que esta
    // bien (Diamante/Oro) pero hace tiempo que no entra al sistema — ahi el
    // pago no alcanza para ver el riesgo de abandono.
    evaluate: (cliente) => {
      const dias = cliente.diasSinActividad;
      if (!cliente.sinActividadReciente || dias === null) return null;
      return {
        titulo: "Sin ingresar al sistema",
        mensaje: `No ingresa a su sistema hace ${dias} día(s).`,
        idOrdenServicio: cliente.ordenVigente.idOrdenServicio,
      };
    },
  },
  // Reglas que necesitan datos que todavia no tenemos (ver spec seccion 20) —
  // NO implementar hasta contar con el endpoint correspondiente, solo agregar
  // un nuevo objeto a este arreglo cuando exista. "+7 dias sin login" ya
  // esta cubierta arriba (sin-actividad-reciente usa fechaInactivo, que es
  // el ultimo ingreso real, no una aproximacion). Las que siguen ahora
  // podrian salir del historial de seguimiento (Administrativo/
  // historial-seguimiento, origen=1 — ver services/historial), pero no estan
  // implementadas todavia:
  // - tiempo excesivo en el estado actual (requeriria leer el historial
  //   completo por cliente, costoso para todo el dataset de una — evaluar)
  // - incidencias recurrentes (aparecen como nestado "INCIDENCIAS" en el
  //   historial, pero es texto libre, no una tabla propia con severidad)
  // - contacto vencido (el historial trae "CLIC PARA LLAMAR A CLIENTE" con
  //   fecha, pero igual que arriba, requeriria leerlo por cliente)
];

export function evaluateAlertas(
  clientes: PostVentaCliente[],
  config: PostVentaConfigValues,
  generatedAt: string
): Alerta[] {
  const alertas: Alerta[] = [];
  for (const cliente of clientes) {
    for (const rule of alertaRules) {
      const result = rule.evaluate(cliente, config);
      if (!result) continue;
      alertas.push({
        id: `${rule.id}:${cliente.numeroDocumentoCliente}:${result.idOrdenServicio ?? "cliente"}`,
        tipo: rule.tipo,
        nivel: rule.nivel,
        titulo: result.titulo,
        mensaje: result.mensaje,
        cliente: cliente.numeroDocumentoCliente,
        nombreCliente: cliente.nombreCliente,
        sistemas: cliente.sistemas,
        idOrdenServicio: result.idOrdenServicio,
        fecha: generatedAt,
        origen: rule.id,
        estado: "ABIERTA",
      });
    }
  }
  return alertas;
}
