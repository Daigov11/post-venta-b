import * as eventoOperativoRepository from "../../repositories/eventoOperativo.repository.js";
import * as tareasRepository from "../../repositories/tareas.repository.js";
import type { PostVentaCliente, Tarea } from "../../types/postventa.js";
import { getPostVentaDataset } from "./postventaCache.js";

// "Trabajamos de lunes a sabado" (confirmado explicitamente) — excluye
// domingo. No existe un calendario de feriados en el sistema, asi que no se
// excluyen feriados (no inventar un calendario que no existe).
// Las tres personas que se reparten el trabajo diario. Coinciden con
// usuario_externo en postventa_usuarios_autorizados (migracion 0046).
// Cualquier otro usuario (ej. 'diegom', 'qa_test_postventa') NO recibe
// tareas del reparto: solo ve las generales.
export const RESPONSABLES_REPARTO = ["Cristian", "Zurirodriguez", "AISBELPV"] as const;

function responsableDeReparto(indice: number): string {
  return RESPONSABLES_REPARTO[indice % RESPONSABLES_REPARTO.length];
}

function esDiaHabil(fecha: Date): boolean {
  return fecha.getDay() !== 0;
}

function fechaIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function periodoDe(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

// Dias habiles ENTRE dos fechas, ambas inclusive — a diferencia de la
// version anterior (que siempre arrancaba en el dia 1 del mes), esto
// permite generar/redistribuir "desde hoy en adelante" sin inventar
// vencimientos en dias que ya pasaron (ver feedback: generar a mitad de mes
// ya no debe crear tareas vencidas de arranque).
function diasHabilesEntre(desde: Date, hasta: Date): Date[] {
  const dias: Date[] = [];
  const cursor = new Date(desde);
  while (cursor.getTime() <= hasta.getTime()) {
    if (esDiaHabil(cursor)) dias.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

function finDeMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
}

function repartirEnDias<T>(items: T[], dias: Date[]): Map<number, T[]> {
  const porDia = new Map<number, T[]>();
  if (dias.length === 0) return porDia;
  const tamanoChunk = Math.ceil(items.length / dias.length);
  items.forEach((item, i) => {
    const diaIndex = Math.min(Math.floor(i / tamanoChunk), dias.length - 1);
    const lista = porDia.get(diaIndex) ?? [];
    lista.push(item);
    porDia.set(diaIndex, lista);
  });
  return porDia;
}

function tituloYDescripcion(mesLabel: string): { titulo: string; descripcion: string } {
  return {
    titulo: "Contacto de seguimiento del mes",
    descripcion: `Reparto mensual automático — contacto rutinario de ${mesLabel}, sin ningún criterio de negocio (reparto parejo).`,
  };
}

// Reparto mensual automatico de TODOS los clientes activos entre los dias
// habiles (lunes a sabado) del periodo en curso, para que cada uno reciba
// un contacto de seguimiento al menos una vez al mes — reparto PAREJO
// (round-robin por numeroDocumentoCliente, orden deterministico), SIN
// ningun criterio de negocio, ROTACION MENSUAL (una vez por periodo, ver
// periodo_reparto/migracion 0040).
//
// Ajuste sobre la version anterior (feedback real con datos): si esto corre
// por primera vez a mitad de mes, YA NO reparte entre TODOS los dias
// habiles del mes completo (eso generaba ~1000 tareas "vencidas" de
// arranque, tapando el trabajo real) — reparte unicamente entre HOY y los
// dias habiles que quedan hasta fin de mes. Insercion en un solo batch
// transaccional (ver bulkCreateRepartoMensual), no N inserts sueltos.
export async function generarRepartoDelPeriodo(): Promise<number> {
  const ahora = new Date();
  const periodo = periodoDe(ahora);
  const dataset = await getPostVentaDataset();
  const clientesOrdenados = [...dataset.clientes].sort((a, b) =>
    a.numeroDocumentoCliente.localeCompare(b.numeroDocumentoCliente)
  );
  if (clientesOrdenados.length === 0) return 0;

  const conReparto = await tareasRepository.clientesConRepartoDelPeriodo(
    clientesOrdenados.map((c) => c.numeroDocumentoCliente),
    periodo
  );
  const pendientesDeAsignar = clientesOrdenados.filter(
    (c) => !conReparto.has(c.numeroDocumentoCliente)
  );
  if (pendientesDeAsignar.length === 0) return 0;

  const dias = diasHabilesEntre(ahora, finDeMes(ahora));
  if (dias.length === 0) return 0; // ultimo dia del mes cayendo domingo, defensivo

  const mesLabel = ahora.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  const { titulo, descripcion } = tituloYDescripcion(mesLabel);
  const porDia = repartirEnDias(pendientesDeAsignar, dias);

  const filas: tareasRepository.RepartoMensualNuevo[] = [];
  let indiceResponsable = 0;
  for (const [diaIndex, clientesDelDia] of porDia) {
    const fecha = fechaIso(dias[diaIndex]);
    for (const cliente of clientesDelDia) {
      filas.push({
        numeroDocumentoCliente: cliente.numeroDocumentoCliente,
        idOrdenServicio: cliente.ordenVigente.idOrdenServicio,
        titulo,
        descripcion,
        responsable: responsableDeReparto(indiceResponsable++),
        prioridad: "MEDIA",
        fechaVencimiento: fecha,
        periodoReparto: periodo,
      });
    }
  }

  return tareasRepository.bulkCreateRepartoMensual(filas);
}

// Redistribucion EXPLICITA (nunca automatica/silenciosa) de las tareas de
// REPARTO_MENSUAL del periodo en curso que quedaron vencidas sin contactar
// — pensada para el caso real: el reparto se genero con datos de un dia
// anterior (ej. la version previa de este sync, que si creaba vencimientos
// desde el dia 1) y ahora hay que ponerlas al dia sin perder rastro.
//
// Nunca borra ni reemplaza filas: reutiliza tareasRepository.update (mismo
// camino que "Postergar" en el controller) para mover fecha_vencimiento, y
// registra un evento TAREA_POSTERGADA por cada una (mismo tipo de evento
// que ya usa el Historial de cambios para cualquier postergacion manual) —
// asi la redistribucion queda visible en el detalle de cada tarea, con la
// fecha anterior y la nueva, sin inventar un tipo de evento nuevo.
export async function redistribuirPendientesDelPeriodo(usuario: string): Promise<{
  redistribuidas: number;
  sinDiasDisponibles: number;
}> {
  const ahora = new Date();
  const periodo = periodoDe(ahora);
  const hoyIso = fechaIso(ahora);
  const pendientes = await tareasRepository.pendientesDeRedistribuir(periodo, hoyIso);
  if (pendientes.length === 0) return { redistribuidas: 0, sinDiasDisponibles: 0 };

  const dias = diasHabilesEntre(ahora, finDeMes(ahora));
  if (dias.length === 0) return { redistribuidas: 0, sinDiasDisponibles: pendientes.length };

  const porDia = repartirEnDias(pendientes, dias);
  let redistribuidas = 0;

  for (const [diaIndex, tareasDelDia] of porDia) {
    const nuevaFecha = fechaIso(dias[diaIndex]);
    for (const tarea of tareasDelDia) {
      const fechaAnterior = tarea.fechaVencimiento;
      if (fechaAnterior === nuevaFecha) continue; // ya cae en el mismo dia, nada que mover
      await tareasRepository.update(tarea.id, { fechaVencimiento: nuevaFecha });
      await eventoOperativoRepository.registrarSeguro({
        usuario,
        tipoAccion: "TAREA_POSTERGADA",
        modulo: "TAREAS",
        numeroDocumentoCliente: tarea.numeroDocumentoCliente,
        entidadTipo: "TAREA",
        entidadId: String(tarea.id),
        detalle: `Redistribución de reparto mensual — antes: ${fechaAnterior ?? "sin fecha"}, ahora: ${nuevaFecha}`,
      });
      redistribuidas += 1;
    }
  }
  return { redistribuidas, sinDiasDisponibles: 0 };
}

export interface TareaCarteraMensual {
  tarea: Tarea;
  cliente: {
    numeroDocumentoCliente: string;
    nombreCliente: string;
    sistemas: PostVentaCliente["sistemas"];
  };
}

export interface ResumenCarteraMensual {
  periodo: string;
  total: number;
  contactados: number; // COMPLETADA
  noContactados: number; // PENDIENTE o EN_PROCESO, fecha >= hoy
  pendientesDeRedistribuir: number; // PENDIENTE, fecha < hoy
  porDia: { fecha: string; total: number; contactados: number }[];
}

// Punto unico de lectura para el panel "Cartera mensual": genera lo que
// falte de este periodo (sync-on-read, mismo patron que
// listTareasRenovacion) y arma el resumen + listado con snapshot de
// cliente. Deliberadamente separado de listTareas/GET /api/tareas (que ya
// NO ejecuta esta sincronizacion, ver feedback de rendimiento) — solo se
// paga este costo cuando alguien realmente abre este panel.
export async function listCarteraMensual(): Promise<{
  resumen: ResumenCarteraMensual;
  data: TareaCarteraMensual[];
}> {
  await generarRepartoDelPeriodo();

  const ahora = new Date();
  const periodo = periodoDe(ahora);
  const hoyIso = fechaIso(ahora);

  const [dataset, tareas] = await Promise.all([
    getPostVentaDataset(),
    tareasRepository.list({ origen: "REPARTO_MENSUAL", periodoReparto: periodo }),
  ]);
  const clientePorDocumento = new Map(dataset.clientes.map((c) => [c.numeroDocumentoCliente, c]));

  const data: TareaCarteraMensual[] = [];
  let contactados = 0;
  let noContactados = 0;
  let pendientesDeRedistribuir = 0;
  const porDiaMap = new Map<string, { total: number; contactados: number }>();

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
      },
    });

    const fecha = tarea.fechaVencimiento ?? "sin fecha";
    const acc = porDiaMap.get(fecha) ?? { total: 0, contactados: 0 };
    acc.total += 1;
    if (tarea.estado === "COMPLETADA") acc.contactados += 1;
    porDiaMap.set(fecha, acc);

    if (tarea.estado === "COMPLETADA") {
      contactados += 1;
    } else if (tarea.estado === "PENDIENTE" && tarea.fechaVencimiento !== null && tarea.fechaVencimiento < hoyIso) {
      pendientesDeRedistribuir += 1;
    } else {
      noContactados += 1;
    }
  }

  const porDia = [...porDiaMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fecha, acc]) => ({ fecha, total: acc.total, contactados: acc.contactados }));

  return {
    resumen: {
      periodo,
      total: data.length,
      contactados,
      noContactados,
      pendientesDeRedistribuir,
      porDia,
    },
    data,
  };
}

// Reasignacion EXPLICITA de las tareas de REPARTO_MENSUAL abiertas
// (PENDIENTE/EN_PROCESO) del periodo en curso entre RESPONSABLES_REPARTO,
// round-robin por dia de vencimiento para que cada dia quede parejo entre
// los tres. Idempotente: las que ya tienen el responsable correcto no se
// tocan. Deja un evento TAREA_REASIGNADA por cada cambio.
export async function reasignarPendientesDelPeriodo(usuario: string): Promise<{
  reasignadas: number;
  total: number;
}> {
  const periodo = periodoDe(new Date());
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
    const nuevo = responsableDeReparto(i);
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
