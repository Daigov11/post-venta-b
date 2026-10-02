import * as bolsaRepository from "../../repositories/bolsa.repository.js";
import * as eventoOperativoRepository from "../../repositories/eventoOperativo.repository.js";
import { calcularResumen, RESUMEN_VACIO } from "./bolsaResumen.js";
import type { BolsaEstado, BolsaResumenDiaAnterior, TipoBolsaConversion } from "../../types/postventa.js";

// "Trabajamos de 8:30am a 7pm hora Peru" (pedido explicito). TZ=America/Lima
// ya esta forzado a nivel de proceso (ver server.ts), asi que
// new Date().getHours()/getMinutes() ya reflejan la hora real de Lima sin
// conversion manual.
const MINUTOS_APERTURA = 8 * 60 + 30;
const MINUTOS_CIERRE = 19 * 60;

function minutosDelDia(fecha: Date): number {
  return fecha.getHours() * 60 + fecha.getMinutes();
}

function estaEnVentanaOperativa(fecha: Date): boolean {
  const m = minutosDelDia(fecha);
  return m >= MINUTOS_APERTURA && m < MINUTOS_CIERRE;
}

function fechaIso(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

// Formato DATETIME de MySQL en hora local del proceso (ya Lima) — nunca usar
// toISOString() para esto, que convierte a UTC y correria el horario.
function datetimeSql(fecha: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${fechaIso(fecha)} ${pad(fecha.getHours())}:${pad(fecha.getMinutes())}:${pad(fecha.getSeconds())}`;
}

// BolsaSesion.abiertaEn/cerradaEn son ISO-8601 (formato de dominio/API, ver
// bolsa.repository.ts toDomain) — para usarlos como parametro de una query
// SQL (BETWEEN ... AND ...) hay que volver a pasarlos por datetimeSql,
// nunca mandar el ISO tal cual: MySQL no lo interpreta igual (esto causaba
// que ganadasEnRango/contarPorTipoEnRango nunca encontraran nada — bug real
// encontrado y corregido durante la verificacion de la primera version).
function sqlFromIso(iso: string): string {
  return datetimeSql(new Date(iso));
}

function ayerDe(fecha: Date): Date {
  const ayer = new Date(fecha);
  ayer.setDate(ayer.getDate() - 1);
  return ayer;
}

// Reconciliacion (pedido explicito): si el scheduler de las 19:00 no pudo
// correr (ej. el proceso estuvo caido, ver feedback sobre la maquina de
// desarrollo reiniciandose por memoria), cualquier acceso a la bolsa
// despues de esa hora cierra las sesiones que quedaron colgadas — a las
// 19:00 de SU fecha, no a "ahora". Barrido global (no solo del usuario que
// esta entrando): es una comparacion barata, tipicamente 0 filas.
async function reconciliarSiHaceFalta(ahora: Date): Promise<void> {
  const cerradas = await bolsaRepository.reconciliarSesionesVencidas(datetimeSql(ahora));
  for (const sesion of cerradas) {
    await eventoOperativoRepository.registrarSeguro({
      usuario: sesion.usuario,
      tipoAccion: "DIA_CERRADO",
      modulo: "RESULTADOS",
      entidadTipo: "BOLSA_SESION",
      entidadId: String(sesion.id),
      detalle: "Cierre automático (reconciliado — el scheduler de las 7pm no llegó a correr)",
    });
  }
}

// Apertura perezosa: la primera vez que ESTE usuario pide su estado dentro
// de la ventana 8:30–19:00 y todavia no tiene ninguna sesion hoy, se le crea
// una automatica en S/0 (pedido explicito) — no hace falta un cron que
// conozca de antemano la lista de usuarios (no existe tabla de usuarios).
export async function obtenerEstadoBolsa(usuario: string): Promise<BolsaEstado> {
  const ahora = new Date();
  await reconciliarSiHaceFalta(ahora);
  const fecha = fechaIso(ahora);

  let sesion = await bolsaRepository.sesionAbiertaDe(usuario, fecha);
  const ultimaDeHoy = sesion ? null : await bolsaRepository.ultimaSesionDe(usuario, fecha);
  const esPrimerIngresoDelDia = !sesion && !ultimaDeHoy;

  if (!sesion && !ultimaDeHoy && estaEnVentanaOperativa(ahora)) {
    sesion = await bolsaRepository.crearSesion({
      usuario,
      fecha,
      numeroApertura: 1,
      abiertaEn: datetimeSql(ahora),
      origenApertura: "AUTOMATICA",
    });
    await eventoOperativoRepository.registrarSeguro({
      usuario,
      tipoAccion: "DIA_ABIERTO",
      modulo: "RESULTADOS",
      entidadTipo: "BOLSA_SESION",
      entidadId: String(sesion.id),
      detalle: "Apertura automática (8:30am)",
    });
  }
  if (!sesion) sesion = ultimaDeHoy;

  const resumen = sesion
    ? await calcularResumen(
        usuario,
        sesion.id,
        sqlFromIso(sesion.abiertaEn),
        sesion.cerradaEn ? sqlFromIso(sesion.cerradaEn) : datetimeSql(ahora)
      )
    : RESUMEN_VACIO;

  // Notificacion del dia anterior (pedido explicito) — solo tiene sentido
  // calcularla en el primer ingreso del dia (si ya hay una sesion de hoy en
  // curso, no hace falta seguir devolviendola en cada poll/refresh).
  const resumenDiaAnterior = esPrimerIngresoDelDia
    ? await obtenerResumenDiaAnterior(usuario, ayerDe(ahora))
    : null;

  return { sesion, resumen, resumenDiaAnterior };
}

async function obtenerResumenDiaAnterior(
  usuario: string,
  ayer: Date
): Promise<BolsaResumenDiaAnterior | null> {
  const fechaAyer = fechaIso(ayer);
  const sesiones = await bolsaRepository.sesionesDe(usuario, fechaAyer);
  if (sesiones.length === 0) return null;

  const inicioAyer = `${fechaAyer} 00:00:00`;
  const finAyer = `${fechaAyer} 23:59:59`;
  const [clientesContactadosUnicos, misionesPorTipo, conversionesPorCategoria] = await Promise.all([
    eventoOperativoRepository.clientesUnicosPorTipoEnRango(
      usuario,
      ["CONTACTO_LLAMADA", "CONTACTO_WHATSAPP"],
      inicioAyer,
      finAyer
    ),
    eventoOperativoRepository.contarPorTipoEnRango(usuario, ["TAREA_COMPLETADA"], inicioAyer, finAyer),
    bolsaRepository.conversionesPorCategoriaEnFecha(usuario, fechaAyer),
  ]);

  return {
    fecha: fechaAyer,
    aperturas: sesiones.length,
    cierres: sesiones.filter((s) => s.estado === "CERRADA").length,
    clientesContactadosUnicos,
    misionesCompletadas: misionesPorTipo.get("TAREA_COMPLETADA") ?? 0,
    conversionesPorCategoria,
  };
}

export async function cerrarBolsa(
  usuario: string,
  observacion: string | null
): Promise<BolsaEstado> {
  const ahora = new Date();
  await reconciliarSiHaceFalta(ahora);
  const fecha = fechaIso(ahora);
  const abierta = await bolsaRepository.sesionAbiertaDe(usuario, fecha);
  if (!abierta) {
    throw new Error("No tienes la bolsa abierta ahora mismo.");
  }
  const cerrada = await bolsaRepository.cerrarSesion(abierta.id, {
    cerradaEn: datetimeSql(ahora),
    origenCierre: "MANUAL",
    observacionCierre: observacion,
  });
  await eventoOperativoRepository.registrarSeguro({
    usuario,
    tipoAccion: "DIA_CERRADO",
    modulo: "RESULTADOS",
    entidadTipo: "BOLSA_SESION",
    entidadId: String(abierta.id),
    detalle: observacion ?? "Cierre manual",
  });
  const resumen = await calcularResumen(
    usuario,
    abierta.id,
    sqlFromIso(abierta.abiertaEn),
    sqlFromIso(cerrada!.cerradaEn!)
  );
  return { sesion: cerrada, resumen, resumenDiaAnterior: null };
}

// Reapertura EXPLICITA durante el dia (pedido: "abrieron/cerraron varias
// veces") — nunca automatica; solo tiene sentido si la ultima sesion de hoy
// ya esta cerrada (si sigue abierta, no hay nada que reabrir).
export async function reabrirBolsa(usuario: string): Promise<BolsaEstado> {
  const ahora = new Date();
  await reconciliarSiHaceFalta(ahora);
  const fecha = fechaIso(ahora);
  const yaAbierta = await bolsaRepository.sesionAbiertaDe(usuario, fecha);
  if (yaAbierta) {
    const resumen = await calcularResumen(
      usuario,
      yaAbierta.id,
      sqlFromIso(yaAbierta.abiertaEn),
      datetimeSql(ahora)
    );
    return { sesion: yaAbierta, resumen, resumenDiaAnterior: null };
  }
  const ultima = await bolsaRepository.ultimaSesionDe(usuario, fecha);
  const sesion = await bolsaRepository.crearSesion({
    usuario,
    fecha,
    numeroApertura: (ultima?.numeroApertura ?? 0) + 1,
    abiertaEn: datetimeSql(ahora),
    origenApertura: "MANUAL",
  });
  await eventoOperativoRepository.registrarSeguro({
    usuario,
    tipoAccion: "DIA_ABIERTO",
    modulo: "RESULTADOS",
    entidadTipo: "BOLSA_SESION",
    entidadId: String(sesion.id),
    detalle: `Reapertura manual (apertura #${sesion.numeroApertura} del día)`,
  });
  const resumen = await calcularResumen(usuario, sesion.id, sqlFromIso(sesion.abiertaEn), datetimeSql(ahora));
  return { sesion, resumen, resumenDiaAnterior: null };
}

// Categorias fijas (pedido explicito, sustituyen al texto libre anterior) —
// "OTRO" es solo una red de seguridad de migracion (ver 0042), nunca se
// ofrece como opcion nueva desde aca.
const CATEGORIAS_CONVERSION_VALIDAS = new Set<TipoBolsaConversion>([
  "CAMBIO_PERIODICIDAD",
  "ADQUISICION_EQUIPO",
  "RECUPERACION_CLIENTE",
  "VENTA_PRODUCTO",
  "APILOYALTY",
  "APIREVIEW",
]);

export function esCategoriaConversionValida(tipo: string): tipo is TipoBolsaConversion {
  return CATEGORIAS_CONVERSION_VALIDAS.has(tipo as TipoBolsaConversion);
}

export async function registrarConversion(
  usuario: string,
  input: { tipo: TipoBolsaConversion; descripcion: string | null }
): Promise<BolsaEstado> {
  const ahora = new Date();
  await reconciliarSiHaceFalta(ahora);
  const fecha = fechaIso(ahora);
  const abierta = await bolsaRepository.sesionAbiertaDe(usuario, fecha);
  if (!abierta) {
    throw new Error("No tienes la bolsa abierta ahora mismo.");
  }
  await bolsaRepository.crearConversion({
    bolsaSesionId: abierta.id,
    tipo: input.tipo,
    descripcion: input.descripcion,
    createdBy: usuario,
  });
  const resumen = await calcularResumen(usuario, abierta.id, sqlFromIso(abierta.abiertaEn), datetimeSql(ahora));
  return { sesion: abierta, resumen, resumenDiaAnterior: null };
}

// Cierre masivo automatico a las 19:00 (ver bolsaScheduler.ts).
export async function cerrarTodasAutomaticamente(): Promise<number> {
  const ahora = new Date();
  const fecha = fechaIso(ahora);
  const cerradas = await bolsaRepository.cerrarTodasLasAbiertasDe(fecha, datetimeSql(ahora));
  for (const sesion of cerradas) {
    await eventoOperativoRepository.registrarSeguro({
      usuario: sesion.usuario,
      tipoAccion: "DIA_CERRADO",
      modulo: "RESULTADOS",
      entidadTipo: "BOLSA_SESION",
      entidadId: String(sesion.id),
      detalle: "Cierre automático (7:00pm)",
    });
  }
  return cerradas.length;
}
