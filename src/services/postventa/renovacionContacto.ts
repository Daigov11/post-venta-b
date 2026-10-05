import * as tareasRepository from "../../repositories/tareas.repository.js";
import * as usuarioAutorizadoRepository from "../../repositories/usuarioAutorizado.repository.js";
import type { PostVentaCliente, TareaRenovacion } from "../../types/postventa.js";
import { asignarResponsablesPorFecha, esClienteActivoParaContacto, hoyLocalIso } from "./contactoProgramado.js";
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

// Un cliente ACTIVO (estado INICIAR COBRANZA) con renovacion en ventana de
// alerta (mismo criterio que la alerta RENOVACION_PROXIMA y el filtro de
// Renovaciones — ver renovacionEnAlerta en enrichCliente.ts) recibe una tarea
// de contacto automatica, una sola vez por ciclo: mientras tenga una tarea
// RENOVACION sin cerrar no se crea otra. Al marcarla COMPLETADA (contactado)
// o CANCELADA, se habilita la siguiente en el proximo ciclo.
//
// MENSUAL queda fuera a proposito: su contacto de cada mes ya lo genera el
// contacto programado (repartoMensualContacto.ts), y crear tambien una tarea
// de renovacion lo contactaria dos veces por mes.
//
// El responsable sale del equipo marcado como "recibe reparto" (el menos
// cargado ese dia, conservando a quien ya atendia al cliente). Si todavia no
// hay nadie marcado, cae al ejecutivo de la orden, como antes.
export async function sincronizarTareasRenovacion(): Promise<number> {
  const dataset = await getPostVentaDataset();
  const candidatos = dataset.clientes.filter(
    (c) =>
      c.renovacionEnAlerta &&
      c.planActual.periodicidad !== "MENSUAL" &&
      esClienteActivoParaContacto(c.ordenVigente.nEstadoApiWorking)
  );
  const conTareaAbierta = await tareasRepository.clientesConRenovacionAbierta(
    candidatos.map((c) => c.numeroDocumentoCliente)
  );
  const nuevos = candidatos.filter((c) => !conTareaAbierta.has(c.numeroDocumentoCliente));
  if (nuevos.length === 0) return 0;

  const receptores = await usuarioAutorizadoRepository.listReceptoresReparto();
  const fechaDe = (c: PostVentaCliente) => (c.proximaRenovacion ? c.proximaRenovacion.slice(0, 10) : hoyLocalIso());
  const [ultimo, carga] = await Promise.all([
    tareasRepository.ultimoResponsablePorCliente(nuevos.map((c) => c.numeroDocumentoCliente)),
    tareasRepository.cargaAbiertaDesde(hoyLocalIso()),
  ]);
  const responsables = asignarResponsablesPorFecha(
    nuevos.map((c) => ({
      clave: c.numeroDocumentoCliente,
      fecha: fechaDe(c),
      ultimoResponsable: ultimo.get(c.numeroDocumentoCliente),
    })),
    receptores,
    carga
  );

  for (const c of nuevos) {
    await tareasRepository.create({
      numeroDocumentoCliente: c.numeroDocumentoCliente,
      idOrdenServicio: c.ordenVigente.idOrdenServicio,
      tipo: "RENOVACION",
      origen: "RENOVACION",
      origenEntidadTipo: "CLIENTE",
      origenEntidadId: c.numeroDocumentoCliente,
      titulo: "Contactar por renovación próxima",
      descripcion: construirDescripcion(c),
      responsable: responsables.get(c.numeroDocumentoCliente) ?? c.ordenVigente.ejecutivo ?? "Sin asignar",
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
