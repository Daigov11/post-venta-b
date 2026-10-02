import { detectarCandidatos } from "../../engines/recuperacion.engine.js";
import * as bajaCacheRepository from "../../repositories/bajaCache.repository.js";
import * as eventoOperativoRepository from "../../repositories/eventoOperativo.repository.js";
import * as recuperacionRepository from "../../repositories/recuperacionEpisodio.repository.js";
import type { EpisodioRecuperacion, EstadoRecuperacion, OrigenRecuperacion } from "../../types/postventa.js";
import { getClientesExcluidos, getPostVentaDataset } from "./postventaCache.js";
import { getConfig } from "./configService.js";

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Deuda es un dato financiero VIVO — nunca se persiste una copia en el
// episodio (podria quedar desactualizada). Se resuelve por idOrdenServicio
// contra el dataset ya cargado, en cada request.
function buildMontoPorOrden(
  clientesActivos: Awaited<ReturnType<typeof getPostVentaDataset>>["clientes"],
  clientesExcluidos: Awaited<ReturnType<typeof getClientesExcluidos>>
): Map<number, number> {
  const mapa = new Map<number, number>();
  for (const cliente of [...clientesActivos, ...clientesExcluidos]) {
    for (const os of cliente.osRefs) {
      mapa.set(os.idOrdenServicio, os.deuda);
    }
  }
  return mapa;
}

// "Sync on read" — mismo patron que Oportunidades/Alertas/Reparto mensual:
// nunca corre en un path caliente ajeno (Dashboard, Tareas, etc.), solo
// cuando se carga la pantalla Recuperacion. No borra ni pisa episodios ya
// cerrados — solo crea los que faltan y transiciona los abiertos segun
// evidencia real del dataset actual. Devuelve el mapa de deuda vigente para
// que el controller lo adjunte a la respuesta sin recalcular el dataset.
export async function sincronizarEpisodios(incluirHistorico = false): Promise<Map<number, number>> {
  const [dataset, excluidos, config] = await Promise.all([
    getPostVentaDataset(),
    getClientesExcluidos(),
    getConfig(),
  ]);

  const numerosBaja = excluidos.map((c) => c.numeroDocumentoCliente);
  const bajaCacheMap = await bajaCacheRepository.findAllByClientes(numerosBaja);

  const candidatos = detectarCandidatos(
    dataset.clientes,
    excluidos,
    bajaCacheMap,
    config,
    new Date(),
    incluirHistorico
  );

  const diasPermanencia = config["recuperacion.dias_permanencia"];
  const candidatosPorOrdenOrigen = new Map(
    candidatos.map((c) => [`${c.idOrdenServicio}:${c.origen}`, c])
  );
  const hoyParaIngreso = hoyIso();

  // 1) Crear episodios nuevos para candidatos sin uno ya abierto. La fecha
  // de ingreso SIEMPRE es hoy (cuando la orden entra a ESTA cola) — nunca
  // una fecha retroactiva del hecho que la origina (ver comentario en
  // CandidatoRecuperacion.evidenciaConfirmada): un vencimiento de hace
  // meses no debe nacer ya "perdido" el mismo dia que se detecta por
  // primera vez.
  for (const candidato of candidatos) {
    const abierto = await recuperacionRepository.findAbiertoPorOrdenOrigen(
      candidato.idOrdenServicio,
      candidato.origen
    );
    if (abierto) continue;

    // No reabrir automaticamente lo que una persona ya cerro como
    // RECUPERADO a mano (accion manual trazable, valida per el pedido) si
    // la evidencia es exactamente la misma de antes — evita que el propio
    // sync-on-read deshaga la decision humana en la siguiente carga de
    // pantalla solo porque el calculo automatico sigue viendo la misma
    // condicion previa (ver comentario en el repositorio).
    const ultimo = await recuperacionRepository.findUltimoEpisodio(
      candidato.idOrdenServicio,
      candidato.origen
    );
    if (ultimo && ultimo.estado === "RECUPERADO" && ultimo.motivo === candidato.motivo) continue;

    const estado: EstadoRecuperacion = candidato.evidenciaConfirmada
      ? "EN_RECUPERACION"
      : "PENDIENTE_VALIDACION";
    const fechaIngreso = candidato.evidenciaConfirmada ? hoyParaIngreso : null;
    const fechaLimite = fechaIngreso ? sumarDias(fechaIngreso, diasPermanencia) : null;

    await recuperacionRepository.create({
      idOrdenServicio: candidato.idOrdenServicio,
      numeroDocumentoCliente: candidato.numeroDocumentoCliente,
      nombreCliente: candidato.nombreCliente,
      origen: candidato.origen,
      estado,
      fechaIngreso,
      fechaLimite,
      motivo: candidato.motivo,
      creadoPor: "sistema (sync recuperacion)",
    });
  }

  // 2) Transicionar los abiertos: perdido por fecha limite vencida, o
  // recuperado por reactivacion comprobable (la orden ya no califica hoy).
  const abiertos = await recuperacionRepository.listAbiertos();
  const hoy = hoyIso();
  for (const episodio of abiertos) {
    const sigueCalificando = candidatosPorOrdenOrigen.has(
      `${episodio.idOrdenServicio}:${episodio.origen}`
    );

    if (!sigueCalificando) {
      await recuperacionRepository.update(episodio.id, {
        estado: "RECUPERADO",
        fechaRecuperacion: hoy,
        resultado: "Reactivación detectada automáticamente en el dataset.",
      });
      await eventoOperativoRepository.registrarSeguro({
        usuario: "sistema",
        tipoAccion: "RECUPERACION_MARCADA_RECUPERADO",
        modulo: "RECUPERACION",
        numeroDocumentoCliente: episodio.numeroDocumentoCliente,
        entidadTipo: "RECUPERACION_EPISODIO",
        entidadId: String(episodio.id),
        detalle: "Reactivación automática — la orden ya no califica para este origen.",
      });
      continue;
    }

    if (episodio.estado === "EN_RECUPERACION" && episodio.fechaLimite && episodio.fechaLimite < hoy) {
      await recuperacionRepository.update(episodio.id, {
        estado: "PERDIDO",
        fechaPerdida: hoy,
      });
      await eventoOperativoRepository.registrarSeguro({
        usuario: "sistema",
        tipoAccion: "RECUPERACION_MARCADA_PERDIDO",
        modulo: "RECUPERACION",
        numeroDocumentoCliente: episodio.numeroDocumentoCliente,
        entidadTipo: "RECUPERACION_EPISODIO",
        entidadId: String(episodio.id),
        detalle: `Fecha límite (${episodio.fechaLimite}) superada sin recuperación.`,
      });
    }
  }

  return buildMontoPorOrden(dataset.clientes, excluidos);
}

function sumarDias(fechaIso: string, dias: number): string {
  const fecha = new Date(`${fechaIso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

export interface RecuperacionFiltros {
  origen?: OrigenRecuperacion;
  responsable?: string;
  estado?: EstadoRecuperacion;
  numeroDocumentoCliente?: string;
  // Solo episodios EN_RECUPERACION cuya fecha_limite cae dentro de N dias
  // desde hoy (incluye ya vencidos, es decir dias negativos).
  diasRestantesMax?: number;
  page?: number;
  pageSize?: number;
}

export interface RecuperacionResumen {
  enRecuperacion: number;
  porVencer: number;
  recuperados: number;
  perdidos: number;
}

export async function listar(
  filtros: RecuperacionFiltros,
  montoPorOrden: Map<number, number>
): Promise<{
  data: (EpisodioRecuperacion & { monto: number | null })[];
  total: number;
  page: number;
  pageSize: number;
  resumen: RecuperacionResumen;
}> {
  const todos = await recuperacionRepository.listAll();

  let filtrados = todos;
  if (filtros.origen) filtrados = filtrados.filter((e) => e.origen === filtros.origen);
  if (filtros.responsable) filtrados = filtrados.filter((e) => e.responsable === filtros.responsable);
  if (filtros.estado) filtrados = filtrados.filter((e) => e.estado === filtros.estado);
  if (filtros.numeroDocumentoCliente) {
    const q = filtros.numeroDocumentoCliente.toLowerCase();
    filtrados = filtrados.filter(
      (e) =>
        e.numeroDocumentoCliente.toLowerCase().includes(q) ||
        e.nombreCliente.toLowerCase().includes(q)
    );
  }
  if (filtros.diasRestantesMax !== undefined) {
    const limite = sumarDias(hoyIso(), filtros.diasRestantesMax);
    filtrados = filtrados.filter((e) => e.fechaLimite !== null && e.fechaLimite <= limite);
  }

  const hoy = hoyIso();
  const en7Dias = sumarDias(hoy, 7);
  const resumen: RecuperacionResumen = {
    enRecuperacion: todos.filter((e) => e.estado === "EN_RECUPERACION").length,
    porVencer: todos.filter(
      (e) => e.estado === "EN_RECUPERACION" && e.fechaLimite !== null && e.fechaLimite <= en7Dias
    ).length,
    recuperados: todos.filter((e) => e.estado === "RECUPERADO").length,
    perdidos: todos.filter((e) => e.estado === "PERDIDO").length,
  };

  const page = filtros.page && filtros.page > 0 ? filtros.page : 1;
  const pageSize = filtros.pageSize && filtros.pageSize > 0 ? filtros.pageSize : 10;
  const inicio = (page - 1) * pageSize;
  const data = filtrados.slice(inicio, inicio + pageSize).map((e) => ({
    ...e,
    monto: montoPorOrden.get(e.idOrdenServicio) ?? null,
  }));

  return { data, total: filtrados.length, page, pageSize, resumen };
}
