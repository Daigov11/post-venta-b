import * as tareasRepository from "../../repositories/tareas.repository.js";
import type { PostVentaCliente, TareaRenovacion } from "../../types/postventa.js";
import { getPostVentaDataset } from "./postventaCache.js";

const PERIODICIDAD_LABEL: Record<string, string> = {
  MENSUAL: "mensual",
  TRIMESTRAL: "trimestral",
  SEMESTRAL: "semestral",
  ANUAL: "anual",
  DESCONOCIDO: "periodicidad desconocida",
};

function construirDescripcion(cliente: PostVentaCliente): string {
  const periodicidad = PERIODICIDAD_LABEL[cliente.planActual.periodicidad] ?? "periodicidad desconocida";
  const dias = cliente.diasParaRenovacion;
  const cuando =
    dias === null
      ? "fecha de renovación no determinada"
      : dias < 0
        ? `vencida hace ${Math.abs(dias)} día(s)`
        : `en ${dias} día(s)`;
  return `Plan ${periodicidad}, renueva ${cuando}.`;
}

// Un cliente con renovacion en ventana de alerta (mismo criterio que la
// alerta RENOVACION_PROXIMA y el filtro de Renovaciones — ver
// renovacionEnAlerta en enrichCliente.ts) recibe una tarea de contacto
// automatica, una sola vez por ciclo: mientras tenga una tarea RENOVACION
// sin cerrar no se crea otra. Al marcarla COMPLETADA (contactado) o
// CANCELADA, se habilita la siguiente en el proximo ciclo.
export async function sincronizarTareasRenovacion(): Promise<number> {
  const dataset = await getPostVentaDataset();
  const candidatos = dataset.clientes.filter((c) => c.renovacionEnAlerta);
  const conTareaAbierta = await tareasRepository.clientesConRenovacionAbierta(
    candidatos.map((c) => c.numeroDocumentoCliente)
  );
  const nuevos = candidatos.filter((c) => !conTareaAbierta.has(c.numeroDocumentoCliente));

  for (const c of nuevos) {
    await tareasRepository.create({
      numeroDocumentoCliente: c.numeroDocumentoCliente,
      idOrdenServicio: c.ordenVigente.idOrdenServicio,
      tipo: "RENOVACION",
      titulo: "Contactar por renovación próxima",
      descripcion: construirDescripcion(c),
      responsable: c.ordenVigente.ejecutivo ?? "Sin asignar",
      prioridad: c.diasParaRenovacion !== null && c.diasParaRenovacion <= 3 ? "ALTA" : "MEDIA",
      fechaVencimiento: c.proximaRenovacion ? c.proximaRenovacion.slice(0, 10) : null,
      createdBy: "Sistema",
    });
  }
  return nuevos.length;
}

export async function listTareasRenovacion(): Promise<TareaRenovacion[]> {
  await sincronizarTareasRenovacion();

  const [dataset, tareas] = await Promise.all([
    getPostVentaDataset(),
    tareasRepository.list({ tipo: "RENOVACION" }),
  ]);
  const clientePorDocumento = new Map(dataset.clientes.map((c) => [c.numeroDocumentoCliente, c]));

  const resultado: TareaRenovacion[] = [];
  for (const tarea of tareas) {
    const cliente = clientePorDocumento.get(tarea.numeroDocumentoCliente);
    // El cliente pudo haber salido del dataset normal (ej. dado de baja)
    // entre que se creo la tarea y ahora — la tarea sigue siendo valida,
    // pero no hay snapshot fresco de periodicidad/ingresos para mostrar.
    if (!cliente) continue;
    resultado.push({
      tarea,
      cliente: {
        numeroDocumentoCliente: cliente.numeroDocumentoCliente,
        nombreCliente: cliente.nombreCliente,
        sistemas: cliente.sistemas,
        periodicidad: cliente.planActual.periodicidad,
        proximaRenovacion: cliente.proximaRenovacion,
        diasParaRenovacion: cliente.diasParaRenovacion,
        ingresoMensualReal: cliente.ingresoMensualReal,
      },
    });
  }
  return resultado;
}
