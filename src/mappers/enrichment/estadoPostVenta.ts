import type { ClienteBase, EstadoPostVenta, PostVentaConfigValues } from "../../types/postventa.js";

// Regla simple y literal del spec: ATENCION si hay deuda, REVISAR si falta
// documentacion o equipo, NORMAL en el resto. Deliberadamente desacoplada de
// nEstado/idEstado (el estado de proceso de APIWorking) — esto es NUESTRO
// estado, calculado a partir de umbrales configurables en postventa_config,
// pensado para poder sustituirse mas adelante por un Health Score.
export function calcularEstadoPostVenta(
  cliente: ClienteBase,
  config: PostVentaConfigValues
): EstadoPostVenta {
  if (cliente.deudaTotal > config["estado.deuda_atencion_min"]) {
    return "ATENCION";
  }

  const documentacionIncompleta =
    cliente.ordenVigente.documentacion.porcentaje < config["estado.documentacion_completa_min"];
  const sinEquipo = !cliente.ordenVigente.existeEquipo;

  if (documentacionIncompleta || sinEquipo) {
    return "REVISAR";
  }

  return "NORMAL";
}
