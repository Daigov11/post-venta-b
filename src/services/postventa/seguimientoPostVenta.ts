import { MS_POR_DIA } from "../../mappers/enrichment/facturacion.js";
import {
  mapHistorialSeguimientoItem,
  type RawHistorialSeguimientoItem,
} from "../../mappers/historialSeguimiento.mapper.js";
import * as seguimientoRepository from "../../repositories/seguimientoPostVenta.repository.js";
import { fetchHistorialSeguimiento } from "../apiworking/externalApi.js";
import { env } from "../../config/env.js";
import type {
  EtapaActualInfo,
  HistorialSeguimientoEvento,
  PostVentaCliente,
  PostVentaConfigValues,
  SeguimientoEtapa,
  SeguimientoResumen,
} from "../../types/postventa.js";
import { ETAPA_LABEL } from "../../types/postventa.js";
import { getConfig } from "./configService.js";
import { getPostVentaDataset } from "./postventaCache.js";

// Confirmado con el negocio: estos 3 nEstadoApiWorking (estado ACTUAL de la
// OS, no del historial) son literalmente "este cliente necesita revision
// post venta" — son la señal real de APIWorking, no una fecha estimada
// nuestra. Un cliente entra al pipeline si tiene alguno de estos, sin
// importar que tan viejo sea (ademas de la regla por fecha de alta que ya
// existia — ninguna reemplaza a la otra, se suman).
const ESTADOS_REVISION_POSTVENTA = new Set([
  "CAPACITADO PENDIENTE DE REVISION",
  "CLIENTE REVISADO POR POST VENTA SIN CAPACITAR",
  "PENDIENTE DE ACTIVACION",
]);

// Detecta clientes que todavia no estan en el pipeline y los da de alta en
// etapa 1 — por fecha de alta (fechaInicioCliente >= fecha de corte) o por
// estar en uno de los ESTADOS_REVISION_POSTVENTA de APIWorking, lo que pase
// primero. Idempotente, se llama al inicio de cada listado en vez de
// necesitar un cron dedicado (mismo espiritu que el resto del dataset, que
// se re-enriquece en cada llamada). No inserta clientes ya cubiertos por el
// import del Excel (esos ya existen con origen IMPORTADO_EXCEL, INSERT
// IGNORE los deja intactos).
export async function sincronizarNuevosClientes(): Promise<number> {
  const [dataset, config] = await Promise.all([getPostVentaDataset(), getConfig()]);
  const fechaCorte = new Date(config["seguimiento.fecha_corte_clientes_nuevos"]);
  const hoy = new Date(dataset.generatedAt);

  const candidatos = dataset.clientes.filter((c) => {
    const porFecha = c.fechaInicioCliente !== null && new Date(c.fechaInicioCliente) >= fechaCorte;
    const porEstado = ESTADOS_REVISION_POSTVENTA.has(
      c.ordenVigente.nEstadoApiWorking.trim().toUpperCase()
    );
    return porFecha || porEstado;
  });
  const existentes = await seguimientoRepository.existingNumeros(
    candidatos.map((c) => c.numeroDocumentoCliente)
  );
  const nuevos = candidatos.filter((c) => !existentes.has(c.numeroDocumentoCliente));

  for (const c of nuevos) {
    // Si entro por fecha de alta usamos esa fecha real; si entro solo por el
    // estado (puede ser un cliente viejo que recien ahora quedo pendiente de
    // revision) no hay una fecha real de "inicio de seguimiento" — se usa
    // hoy, no se inventa una fecha pasada.
    const fechaInicio =
      c.fechaInicioCliente && new Date(c.fechaInicioCliente) >= fechaCorte
        ? c.fechaInicioCliente.slice(0, 10)
        : hoy.toISOString().slice(0, 10);
    await seguimientoRepository.insertCliente({
      numeroDocumentoCliente: c.numeroDocumentoCliente,
      idOrdenServicio: c.ordenVigente.idOrdenServicio,
      fechaInicio,
      origen: "AUTOMATICO",
    });
  }
  return nuevos.length;
}

// Senales de alerta en el texto libre de la etapa 3 — si aparecen, el
// cliente no se marca EXITOSO solo, queda REQUIERE_ATENCION para revision
// humana en vez de asumir que todo salio bien.
const SENALES_ATENCION = ["BAJA", "NO QUIERE", "INCIDENCIA", "SIN CONTACTAR", "SIN RESPUESTA"];

function requiereAtencion(etapa3: SeguimientoEtapa | undefined): boolean {
  if (!etapa3) return false;
  const texto = `${etapa3.estadoSeguimiento ?? ""} ${etapa3.resumen ?? ""}`.toUpperCase();
  return SENALES_ATENCION.some((s) => texto.includes(s));
}

// Etapa actual del cliente en el pipeline, calculada en vivo a partir de que
// etapas ya se registraron y cuantos dias pasaron desde la ultima — no se
// guarda como estado mutable aparte (mismo patron que diasVencido/
// diasSinActividad en el resto del dataset).
export function calcularEtapaActual(
  etapas: SeguimientoEtapa[],
  config: PostVentaConfigValues,
  ahora: Date = new Date()
): EtapaActualInfo | null {
  const e1 = etapas.find((e) => e.etapa === 1);
  const e2 = etapas.find((e) => e.etapa === 2);
  const e3 = etapas.find((e) => e.etapa === 3);

  if (!e1) {
    return { etapa: 1, label: ETAPA_LABEL[1], diasParaSiguiente: 0, vencida: true };
  }
  if (!e2) {
    if (!e1.fechaRealizado) return { etapa: 2, label: ETAPA_LABEL[2], diasParaSiguiente: null, vencida: false };
    const dias = Math.floor((ahora.getTime() - new Date(e1.fechaRealizado).getTime()) / MS_POR_DIA);
    const faltan = config["seguimiento.dias_etapa2"] - dias;
    return { etapa: 2, label: ETAPA_LABEL[2], diasParaSiguiente: faltan, vencida: faltan <= 0 };
  }
  if (!e3) {
    if (!e2.fechaRealizado) return { etapa: 3, label: ETAPA_LABEL[3], diasParaSiguiente: null, vencida: false };
    const dias = Math.floor((ahora.getTime() - new Date(e2.fechaRealizado).getTime()) / MS_POR_DIA);
    const faltan = config["seguimiento.dias_etapa3"] - dias;
    return { etapa: 3, label: ETAPA_LABEL[3], diasParaSiguiente: faltan, vencida: faltan <= 0 };
  }
  return null; // las 3 etapas ya se registraron -> el pipeline ya tiene un estado final
}

export function calcularEstadoPipelineFinal(etapas: SeguimientoEtapa[]): "EXITOSO" | "REQUIERE_ATENCION" {
  const e3 = etapas.find((e) => e.etapa === 3);
  return requiereAtencion(e3) ? "REQUIERE_ATENCION" : "EXITOSO";
}

interface RawHistorialResponse {
  codResponse?: string;
  message?: string;
  data?: unknown;
}

// Incidencias reales del cliente (Administrativo/historial-seguimiento,
// origen=1) — mismo endpoint que ya integramos para el historial de la
// Ficha 360, filtrado a solo los eventos de tipo INCIDENCIAS. Es informativo
// (que se contacto/reporto), no dice si quedo resuelta: eso lo evalua quien
// registra el seguimiento, no se infiere del texto libre.
export async function buscarIncidenciasCliente(
  idOrdenServicio: number
): Promise<HistorialSeguimientoEvento[]> {
  const token = env.fallbackApiToken;
  if (!token) return [];
  const raw = (await fetchHistorialSeguimiento(token, { idOrdenServicio })) as RawHistorialResponse;
  const filas = Array.isArray(raw?.data) ? (raw.data as RawHistorialSeguimientoItem[]) : [];
  return filas
    .map(mapHistorialSeguimientoItem)
    .filter((ev) => ev.estado.trim().toUpperCase().includes("INCIDENCIA"))
    .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
}

export function construirResumen(
  cliente: PostVentaCliente,
  etapas: SeguimientoEtapa[],
  estadoPipeline: SeguimientoResumen["estadoPipeline"],
  origen: SeguimientoResumen["origen"],
  fechaInicio: string,
  config: PostVentaConfigValues
): SeguimientoResumen {
  return {
    numeroDocumentoCliente: cliente.numeroDocumentoCliente,
    nombreCliente: cliente.nombreCliente,
    plan: cliente.planActual.nombre,
    sistemas: cliente.sistemas,
    ejecutivo: cliente.ordenVigente.ejecutivo,
    origen,
    estadoPipeline,
    fechaInicio,
    etapaActual: estadoPipeline === "EN_PROCESO" ? calcularEtapaActual(etapas, config) : null,
  };
}
