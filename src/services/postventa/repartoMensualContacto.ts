import * as eventoOperativoRepository from "../../repositories/eventoOperativo.repository.js";
import * as tareasRepository from "../../repositories/tareas.repository.js";
import * as usuarioAutorizadoRepository from "../../repositories/usuarioAutorizado.repository.js";
import type { PostVentaCliente, Tarea } from "../../types/postventa.js";
import {
  contactoDelPeriodo,
  diasHabilesEntre,
  esClienteActivoParaContacto,
  finDeMes,
  hoyLocalIso,
  periodoAnterior,
  periodoDe,
  planificarContactos,
  type CargaExistente,
  type ItemParaPlanificar,
} from "./contactoProgramado.js";
import { getPostVentaDataset } from "./postventaCache.js";

const TITULO_CONTACTO = "Contacto de seguimiento";

function descripcionContacto(motivo: string, periodo: string): string {
  return `Contacto programado (${periodo}) — ${motivo}.`;
}

// Cuanto aporta una tarea ya existente a la carga de un dia/persona — se usa
// para restar las que una reconstruccion va a volver a ubicar, y asi no
// contarlas dos veces.
function restarCarga(base: CargaExistente[], tareas: Tarea[], desde: string): CargaExistente[] {
  const resta = new Map<string, number>();
  for (const t of tareas) {
    if (!t.fechaVencimiento || t.fechaVencimiento < desde) continue;
    const clave = `${t.fechaVencimiento}|${t.responsable}`;
    resta.set(clave, (resta.get(clave) ?? 0) + 1);
  }
  return base
    .map((c) => ({ ...c, total: c.total - (resta.get(`${c.fecha}|${c.responsable}`) ?? 0) }))
    .filter((c) => c.total > 0);
}

interface ResultadoSync {
  nuevas: number;
  replanificadas: number;
  canceladas: number;
}

// Reparto del contacto programado de la cartera ACTIVA (estado INICIAR
// COBRANZA) del periodo en curso. A cada cliente le toca (o no) un contacto
// este mes segun su periodicidad (ver contactoDelPeriodo) y se reparte entre
// los dias habiles que quedan y las personas marcadas como "recibe reparto"
// en Configuracion (ver planificarContactos).
//
// Sin `reconstruir` solo agrega lo que falta (idempotente: la restriccion
// UNIQUE cliente+origen+periodo de la migracion 0040 impide duplicar). Con
// `reconstruir` ademas reubica las PENDIENTES del periodo segun las reglas
// vigentes y cancela las que ya no corresponden (cliente que ya no esta
// activo o al que no le toca contacto este mes). Nunca borra filas, nunca
// toca COMPLETADA/EN_PROCESO/CANCELADA, y deja un evento por cada cambio.
async function sincronizarPeriodo(opts: { reconstruir: boolean; usuario: string }): Promise<ResultadoSync> {
  const hoy = hoyLocalIso();
  const periodo = periodoDe(hoy);
  const receptores = await usuarioAutorizadoRepository.listReceptoresReparto();
  const vacio: ResultadoSync = { nuevas: 0, replanificadas: 0, canceladas: 0 };
  if (receptores.length === 0) return vacio;

  const dataset = await getPostVentaDataset();
  const elegibles = new Map<string, PostVentaCliente>();
  for (const c of dataset.clientes) {
    if (esClienteActivoParaContacto(c.ordenVigente.nEstadoApiWorking)) elegibles.set(c.numeroDocumentoCliente, c);
  }

  const contactoPorCliente = new Map<string, NonNullable<ReturnType<typeof contactoDelPeriodo>>>();
  for (const [doc, c] of elegibles) {
    const contacto = contactoDelPeriodo(c.planActual.periodicidad, c.proximaRenovacion, periodo, hoy);
    if (contacto) contactoPorCliente.set(doc, contacto);
  }

  // Un contacto "atrasado" (su fecha cayo el mes pasado) solo se agenda si el
  // mes pasado no se alcanzo a generar; si no, el cliente se contactaria dos
  // veces por la misma renovacion.
  const atrasados = [...contactoPorCliente].filter(([, c]) => c.tipo === "FECHA" && c.atrasado).map(([doc]) => doc);
  if (atrasados.length > 0) {
    const yaGenerados = await tareasRepository.clientesConRepartoDelPeriodo(atrasados, periodoAnterior(periodo));
    for (const doc of yaGenerados) contactoPorCliente.delete(doc);
  }

  const pendientes = opts.reconstruir ? await tareasRepository.repartoPendienteDelPeriodo(periodo) : [];
  const aReubicar = pendientes.filter((t) => contactoPorCliente.has(t.numeroDocumentoCliente));
  const aCancelar = pendientes.filter((t) => !contactoPorCliente.has(t.numeroDocumentoCliente));

  const candidatos = [...contactoPorCliente.keys()];
  const yaConReparto = await tareasRepository.clientesConRepartoDelPeriodo(candidatos, periodo);
  const nuevosClientes = candidatos.filter((doc) => !yaConReparto.has(doc));

  const aPlanificar = [...new Set([...nuevosClientes, ...aReubicar.map((t) => t.numeroDocumentoCliente)])];
  const ultimo = await tareasRepository.ultimoResponsablePorCliente(aPlanificar);
  const items: ItemParaPlanificar[] = aPlanificar.map((doc) => ({
    clave: doc,
    contacto: contactoPorCliente.get(doc)!,
    ultimoResponsable: ultimo.get(doc),
  }));

  const cargaBase = restarCarga(await tareasRepository.cargaAbiertaDesde(hoy), aReubicar, hoy);
  const plan = planificarContactos(items, { hoy, finPeriodo: finDeMes(hoy), receptores, cargaBase });
  const planPorCliente = new Map(plan.map((a) => [a.clave, a]));

  const filasNuevas: tareasRepository.RepartoMensualNuevo[] = [];
  for (const doc of nuevosClientes) {
    const asignacion = planPorCliente.get(doc);
    if (!asignacion) continue;
    filasNuevas.push({
      numeroDocumentoCliente: doc,
      idOrdenServicio: elegibles.get(doc)!.ordenVigente.idOrdenServicio,
      titulo: TITULO_CONTACTO,
      descripcion: descripcionContacto(contactoPorCliente.get(doc)!.motivo, periodo),
      responsable: asignacion.responsable,
      prioridad: "MEDIA",
      fechaVencimiento: asignacion.fecha,
      periodoReparto: periodo,
    });
  }
  const nuevas = await tareasRepository.bulkCreateRepartoMensual(filasNuevas);

  let replanificadas = 0;
  for (const tarea of aReubicar) {
    const asignacion = planPorCliente.get(tarea.numeroDocumentoCliente);
    if (!asignacion) continue;
    const motivo = contactoPorCliente.get(tarea.numeroDocumentoCliente)!.motivo;
    const cambioFecha = tarea.fechaVencimiento !== asignacion.fecha;
    const cambioResponsable = tarea.responsable !== asignacion.responsable;
    const descripcion = descripcionContacto(motivo, periodo);
    if (!cambioFecha && !cambioResponsable && tarea.titulo === TITULO_CONTACTO && tarea.descripcion === descripcion) continue;

    await tareasRepository.update(tarea.id, {
      titulo: TITULO_CONTACTO,
      descripcion,
      fechaVencimiento: asignacion.fecha,
      responsable: asignacion.responsable,
    });
    const base = {
      usuario: opts.usuario,
      modulo: "TAREAS" as const,
      numeroDocumentoCliente: tarea.numeroDocumentoCliente,
      entidadTipo: "TAREA",
      entidadId: String(tarea.id),
    };
    if (cambioFecha) {
      await eventoOperativoRepository.registrarSeguro({
        ...base,
        tipoAccion: "TAREA_POSTERGADA",
        detalle: `Reconstrucción del reparto — antes: ${tarea.fechaVencimiento ?? "sin fecha"}, ahora: ${asignacion.fecha}`,
      });
    }
    if (cambioResponsable) {
      await eventoOperativoRepository.registrarSeguro({
        ...base,
        tipoAccion: "TAREA_REASIGNADA",
        detalle: `Reconstrucción del reparto — reasignada a ${asignacion.responsable} (antes: ${tarea.responsable})`,
      });
    }
    replanificadas += 1;
  }

  // No existe un tipo de evento "cancelada": el motivo queda en la propia
  // descripcion de la tarea, que es lo que se ve en su detalle.
  let canceladas = 0;
  for (const tarea of aCancelar) {
    const cliente = dataset.clientes.find((c) => c.numeroDocumentoCliente === tarea.numeroDocumentoCliente);
    const razon = !cliente || !esClienteActivoParaContacto(cliente.ordenVigente.nEstadoApiWorking)
      ? "el cliente ya no está en estado INICIAR COBRANZA"
      : "a este cliente no le toca contacto este mes según su periodicidad";
    await tareasRepository.update(tarea.id, {
      estado: "CANCELADA",
      descripcion: `${tarea.descripcion ?? ""} — Cancelada en la reconstrucción del reparto: ${razon}.`.trim(),
    });
    canceladas += 1;
  }

  return { nuevas, replanificadas, canceladas };
}

export async function generarRepartoDelPeriodo(): Promise<number> {
  const { nuevas } = await sincronizarPeriodo({ reconstruir: false, usuario: "Sistema" });
  return nuevas;
}

// Accion EXPLICITA de un admin (nunca automatica): aplica las reglas actuales
// a las tareas de reparto del mes que siguen PENDIENTES. Pensada para la
// transicion desde el reparto anterior (todos los clientes, sin cadencia).
export async function reconstruirRepartoDelPeriodo(usuario: string): Promise<ResultadoSync> {
  return sincronizarPeriodo({ reconstruir: true, usuario });
}

// Redistribucion EXPLICITA (nunca automatica/silenciosa) de las tareas de
// REPARTO_MENSUAL del periodo en curso que quedaron vencidas sin contactar:
// las mueve a los dias habiles que quedan, buscando los dias menos cargados.
// Nunca borra ni reemplaza filas: reutiliza tareasRepository.update y
// registra un TAREA_POSTERGADA por cada una, con la fecha anterior y la nueva.
export async function redistribuirPendientesDelPeriodo(usuario: string): Promise<{
  redistribuidas: number;
  sinDiasDisponibles: number;
}> {
  const hoy = hoyLocalIso();
  const periodo = periodoDe(hoy);
  const pendientes = await tareasRepository.pendientesDeRedistribuir(periodo, hoy);
  if (pendientes.length === 0) return { redistribuidas: 0, sinDiasDisponibles: 0 };

  const fin = finDeMes(hoy);
  if (diasHabilesEntre(hoy, fin).length === 0) return { redistribuidas: 0, sinDiasDisponibles: pendientes.length };

  // Cada tarea conserva a su responsable: aca solo se elige el dia. Los
  // "receptores" del plan son quienes ya las tienen.
  const receptores = [...new Set(pendientes.map((t) => t.responsable))].sort((a, b) => a.localeCompare(b));
  const items: ItemParaPlanificar[] = pendientes.map((t) => ({
    clave: String(t.id),
    contacto: { tipo: "LIBRE", motivo: "" },
    ultimoResponsable: t.responsable,
  }));
  const cargaBase = await tareasRepository.cargaAbiertaDesde(hoy);
  const plan = planificarContactos(items, { hoy, finPeriodo: fin, receptores, cargaBase });
  const fechaPorId = new Map(plan.map((a) => [a.clave, a.fecha]));

  let redistribuidas = 0;
  for (const tarea of pendientes) {
    const nuevaFecha = fechaPorId.get(String(tarea.id));
    if (!nuevaFecha || tarea.fechaVencimiento === nuevaFecha) continue;
    await tareasRepository.update(tarea.id, { fechaVencimiento: nuevaFecha });
    await eventoOperativoRepository.registrarSeguro({
      usuario,
      tipoAccion: "TAREA_POSTERGADA",
      modulo: "TAREAS",
      numeroDocumentoCliente: tarea.numeroDocumentoCliente,
      entidadTipo: "TAREA",
      entidadId: String(tarea.id),
      detalle: `Redistribución de reparto mensual — antes: ${tarea.fechaVencimiento ?? "sin fecha"}, ahora: ${nuevaFecha}`,
    });
    redistribuidas += 1;
  }
  return { redistribuidas, sinDiasDisponibles: 0 };
}

export interface TareaCarteraMensual {
  tarea: Tarea;
  cliente: {
    numeroDocumentoCliente: string;
    nombreCliente: string;
    sistemas: PostVentaCliente["sistemas"];
    periodicidad: PostVentaCliente["planActual"]["periodicidad"];
  };
}

export interface ResumenCarteraMensual {
  periodo: string;
  total: number;
  contactados: number; // COMPLETADA
  noContactados: number; // PENDIENTE o EN_PROCESO, fecha >= hoy
  pendientesDeRedistribuir: number; // PENDIENTE, fecha < hoy
  porDia: { fecha: string; total: number; contactados: number }[];
  // Carga por persona, para que el reparto se pueda auditar a simple vista.
  porResponsable: { responsable: string; total: number; contactados: number }[];
}

// Que tareas ve quien consulta: un ADMIN ve todas (o solo las suyas si lo
// pide, util cuando el admin tambien recibe reparto); el resto, solo las suyas.
export interface AlcanceCartera {
  usuario: string;
  esAdmin: boolean;
  soloMias: boolean;
}

// Punto unico de lectura para el panel "Cartera mensual": genera lo que
// falte de este periodo (sync-on-read, mismo patron que
// listTareasRenovacion) y arma el resumen + listado con snapshot de
// cliente. Deliberadamente separado de listTareas/GET /api/tareas (que ya
// NO ejecuta esta sincronizacion, ver feedback de rendimiento) — solo se
// paga este costo cuando alguien realmente abre este panel.
export async function listCarteraMensual(alcance: AlcanceCartera): Promise<{
  resumen: ResumenCarteraMensual;
  data: TareaCarteraMensual[];
}> {
  await generarRepartoDelPeriodo();

  const hoy = hoyLocalIso();
  const periodo = periodoDe(hoy);

  const [dataset, todas] = await Promise.all([
    getPostVentaDataset(),
    tareasRepository.list({ origen: "REPARTO_MENSUAL", periodoReparto: periodo }),
  ]);
  const miUsuario = alcance.usuario.toLowerCase();
  const tareas = (alcance.esAdmin && !alcance.soloMias
    ? todas
    : todas.filter((t) => t.responsable.toLowerCase() === miUsuario)
  ).filter((t) => t.estado !== "CANCELADA");
  const clientePorDocumento = new Map(dataset.clientes.map((c) => [c.numeroDocumentoCliente, c]));

  const data: TareaCarteraMensual[] = [];
  let contactados = 0;
  let noContactados = 0;
  let pendientesDeRedistribuir = 0;
  const porDiaMap = new Map<string, { total: number; contactados: number }>();
  const porResponsableMap = new Map<string, { total: number; contactados: number }>();

  for (const tarea of tareas) {
    const cliente = clientePorDocumento.get(tarea.numeroDocumentoCliente);
    // Mismo criterio que TareaRenovacion: si el cliente ya no esta en el
    // dataset activo (ej. dado de baja despues de generarse el reparto), la
    // tarea sigue siendo real pero no hay snapshot fresco que mostrar.
    if (!cliente) continue;

    data.push({
      tarea,
      cliente: {
        numeroDocumentoCliente: cliente.numeroDocumentoCliente,
        nombreCliente: cliente.nombreCliente,
        sistemas: cliente.sistemas,
        periodicidad: cliente.planActual.periodicidad,
      },
    });

    const contactada = tarea.estado === "COMPLETADA";
    const fecha = tarea.fechaVencimiento ?? "sin fecha";
    const dia = porDiaMap.get(fecha) ?? { total: 0, contactados: 0 };
    dia.total += 1;
    if (contactada) dia.contactados += 1;
    porDiaMap.set(fecha, dia);
    const persona = porResponsableMap.get(tarea.responsable) ?? { total: 0, contactados: 0 };
    persona.total += 1;
    if (contactada) persona.contactados += 1;
    porResponsableMap.set(tarea.responsable, persona);

    if (contactada) {
      contactados += 1;
    } else if (tarea.estado === "PENDIENTE" && tarea.fechaVencimiento !== null && tarea.fechaVencimiento < hoy) {
      pendientesDeRedistribuir += 1;
    } else {
      noContactados += 1;
    }
  }

  const porDia = [...porDiaMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fecha, acc]) => ({ fecha, total: acc.total, contactados: acc.contactados }));
  const porResponsable = [...porResponsableMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([responsable, acc]) => ({ responsable, total: acc.total, contactados: acc.contactados }));

  return {
    resumen: { periodo, total: data.length, contactados, noContactados, pendientesDeRedistribuir, porDia, porResponsable },
    data,
  };
}

// Reasignacion EXPLICITA de las tareas de REPARTO_MENSUAL abiertas
// (PENDIENTE/EN_PROCESO) del periodo en curso entre las personas marcadas
// como "recibe reparto", parejo por dia de vencimiento. Idempotente: las que
// ya tienen el responsable correcto no se tocan. Deja un evento
// TAREA_REASIGNADA por cada cambio.
export async function reasignarPendientesDelPeriodo(usuario: string): Promise<{
  reasignadas: number;
  total: number;
}> {
  const receptores = await usuarioAutorizadoRepository.listReceptoresReparto();
  if (receptores.length === 0) return { reasignadas: 0, total: 0 };

  const periodo = periodoDe(hoyLocalIso());
  const abiertas = (
    await tareasRepository.list({ origen: "REPARTO_MENSUAL", periodoReparto: periodo })
  ).filter((t) => t.estado === "PENDIENTE" || t.estado === "EN_PROCESO");

  abiertas.sort(
    (a, b) =>
      (a.fechaVencimiento ?? "").localeCompare(b.fechaVencimiento ?? "") ||
      a.numeroDocumentoCliente.localeCompare(b.numeroDocumentoCliente)
  );

  let reasignadas = 0;
  for (const [i, tarea] of abiertas.entries()) {
    const nuevo = receptores[i % receptores.length];
    if (tarea.responsable === nuevo) continue;
    await tareasRepository.update(tarea.id, { responsable: nuevo });
    await eventoOperativoRepository.registrarSeguro({
      usuario,
      tipoAccion: "TAREA_REASIGNADA",
      modulo: "TAREAS",
      numeroDocumentoCliente: tarea.numeroDocumentoCliente,
      entidadTipo: "TAREA",
      entidadId: String(tarea.id),
      detalle: `Reasignada a ${nuevo} (reparto diario entre el equipo) — antes: ${tarea.responsable}`,
    });
    reasignadas += 1;
  }
  return { reasignadas, total: abiertas.length };
}
