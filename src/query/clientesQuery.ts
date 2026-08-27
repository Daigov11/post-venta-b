import type { EstadoPostVenta, Periodicidad, PostVentaCliente } from "../types/postventa.js";

export interface ClientesFilter {
  search?: string;
  estado?: EstadoPostVenta;
  plan?: string;
  periodicidad?: Periodicidad;
  ejecutivo?: string;
  tipoOS?: string;
  distribuidor?: string;
  conDeuda?: boolean;
  conEquipo?: boolean;
  documentacionCompleta?: boolean;
  departamento?: string;
  antiguedadMesesMin?: number;
  antiguedadMesesMax?: number;
  comprobantesMin?: number;
  comprobantesMax?: number;
  // Segmentacion por "Ingresos mensuales" — el dato que reporta APIWorking
  // sobre la facturacion del cliente (ordenVigente.postVentaExtra.
  // ingresosClienteMensual), formula no documentada por APIWorking pero es
  // la columna que ya se muestra en la UI con ese nombre.
  ingresosMensualesMin?: number;
  ingresosMensualesMax?: number;
  segmento?: string;
  // Filtro dedicado para el item 17 del spec — usa el mismo booleano
  // precalculado que la alerta RENOVACION_PROXIMA (ver facturacion.ts).
  renovacionProxima?: boolean;
  // Usa el mismo booleano precalculado que la alerta SIN_ACTIVIDAD_RECIENTE
  // (ver enrichCliente.ts) — mismo criterio en filtro y alerta.
  sinActividadReciente?: boolean;
  // Estado CRUDO de APIWorking (ordenVigente.nEstadoApiWorking), distinto de
  // "estado" (que filtra por nuestro estadoPostVentaEfectivo de 3 niveles) —
  // usado por el mini-modulo "Suspendidos por falta de pago" de Clientes.
  nEstadoApiWorkingRaw?: string;
  // Mini-modulos "Clientes nuevos" / "Suspendidos por pago" — fechaInicioCliente
  // / vencidoDesde dentro del periodo elegido (dia/semana/mes/anio, alineado a
  // calendario). `referencia` es cualquier fecha ISO dentro del periodo a
  // mostrar, lo que permite navegar a periodos anteriores/siguientes.
  nuevoPeriodo?: { granularidad: Granularidad; referencia: string };
  suspendidoPeriodo?: { granularidad: Granularidad; referencia: string };
}

export type Granularidad = "dia" | "semana" | "mes" | "anio";

export function inicioDePeriodo(granularidad: Granularidad, fecha: Date): Date {
  if (granularidad === "dia") return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  if (granularidad === "semana") {
    const inicioHoy = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    inicioHoy.setDate(inicioHoy.getDate() - inicioHoy.getDay());
    return inicioHoy;
  }
  if (granularidad === "mes") return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  return new Date(fecha.getFullYear(), 0, 1);
}

function finDePeriodo(granularidad: Granularidad, inicio: Date): Date {
  const fin = new Date(inicio);
  if (granularidad === "dia") fin.setDate(fin.getDate() + 1);
  else if (granularidad === "semana") fin.setDate(fin.getDate() + 7);
  else if (granularidad === "mes") fin.setMonth(fin.getMonth() + 1);
  else fin.setFullYear(fin.getFullYear() + 1);
  return fin;
}

export function rangoDePeriodo(
  granularidad: Granularidad,
  referencia: Date
): { inicio: Date; fin: Date } {
  const inicio = inicioDePeriodo(granularidad, referencia);
  return { inicio, fin: finDePeriodo(granularidad, inicio) };
}

export type ClientesSortField =
  | "nombreCliente"
  | "deudaTotal"
  | "antiguedadMeses"
  | "cantidadComprobantesHistorico"
  | "estadoPostVentaEfectivo"
  | "fechaOs"
  | "fechaInicioCliente"
  | "vencidoDesde"
  | "diasParaRenovacion"
  | "ingresosClienteMensual"
  | "diasSinActividad";

export interface ClientesQueryOptions {
  filter?: ClientesFilter;
  sortBy?: ClientesSortField;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface ClientesQueryResult {
  data: PostVentaCliente[];
  page: number;
  pageSize: number;
  total: number;
}

function matchesSearch(cliente: PostVentaCliente, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  if (cliente.nombreCliente.toLowerCase().includes(needle)) return true;
  if (cliente.numeroDocumentoCliente.toLowerCase().includes(needle)) return true;
  if (cliente.telefonoEfectivo?.toLowerCase().includes(needle)) return true;
  return cliente.osRefs.some((os) => os.numeroOs.toLowerCase().includes(needle));
}

function departamentoDe(cliente: PostVentaCliente): string | null {
  const ubicacion = cliente.ubicacion;
  if (ubicacion && "departamento" in ubicacion) return ubicacion.departamento;
  return null;
}

function filterClientes(clientes: PostVentaCliente[], filter: ClientesFilter): PostVentaCliente[] {
  return clientes.filter((cliente) => {
    if (filter.search && !matchesSearch(cliente, filter.search)) return false;
    if (filter.estado && cliente.estadoPostVentaEfectivo !== filter.estado) return false;
    if (filter.plan && cliente.planActual.nombre !== filter.plan) return false;
    if (filter.periodicidad && cliente.planActual.periodicidad !== filter.periodicidad) return false;
    if (filter.ejecutivo && cliente.ordenVigente.ejecutivo !== filter.ejecutivo) return false;
    if (filter.tipoOS && cliente.ordenVigente.tipoOS !== filter.tipoOS) return false;
    if (
      filter.distribuidor &&
      cliente.ordenVigente.distribuidor?.nombre !== filter.distribuidor
    ) {
      return false;
    }
    if (filter.conDeuda !== undefined) {
      const tieneDeuda = cliente.deudaTotal > 0;
      if (tieneDeuda !== filter.conDeuda) return false;
    }
    if (filter.conEquipo !== undefined) {
      if (cliente.ordenVigente.existeEquipo !== filter.conEquipo) return false;
    }
    if (filter.documentacionCompleta !== undefined) {
      const completa = cliente.documentacionGlobal.porcentaje === 100;
      if (completa !== filter.documentacionCompleta) return false;
    }
    if (filter.departamento && departamentoDe(cliente) !== filter.departamento) return false;
    if (filter.antiguedadMesesMin !== undefined) {
      if (cliente.antiguedad.meses === null || cliente.antiguedad.meses < filter.antiguedadMesesMin) {
        return false;
      }
    }
    if (filter.antiguedadMesesMax !== undefined) {
      if (cliente.antiguedad.meses === null || cliente.antiguedad.meses > filter.antiguedadMesesMax) {
        return false;
      }
    }
    if (filter.comprobantesMin !== undefined) {
      if (cliente.cantidadComprobantesHistorico < filter.comprobantesMin) return false;
    }
    if (filter.comprobantesMax !== undefined) {
      if (cliente.cantidadComprobantesHistorico > filter.comprobantesMax) return false;
    }
    if (filter.ingresosMensualesMin !== undefined) {
      const ingresos = cliente.ordenVigente.postVentaExtra?.ingresosClienteMensual;
      if (ingresos == null || ingresos < filter.ingresosMensualesMin) return false;
    }
    if (filter.ingresosMensualesMax !== undefined) {
      const ingresos = cliente.ordenVigente.postVentaExtra?.ingresosClienteMensual;
      if (ingresos == null || ingresos > filter.ingresosMensualesMax) return false;
    }
    if (filter.segmento && cliente.segmentoEfectivo !== filter.segmento) return false;
    if (filter.renovacionProxima !== undefined) {
      if (cliente.renovacionEnAlerta !== filter.renovacionProxima) return false;
    }
    if (filter.sinActividadReciente !== undefined) {
      if (cliente.sinActividadReciente !== filter.sinActividadReciente) return false;
    }
    if (filter.nEstadoApiWorkingRaw) {
      if (
        cliente.ordenVigente.nEstadoApiWorking.trim().toUpperCase() !==
        filter.nEstadoApiWorkingRaw.trim().toUpperCase()
      ) {
        return false;
      }
    }
    if (filter.nuevoPeriodo) {
      if (!cliente.fechaInicioCliente) return false;
      const { inicio, fin } = rangoDePeriodo(
        filter.nuevoPeriodo.granularidad,
        new Date(filter.nuevoPeriodo.referencia)
      );
      const fecha = new Date(cliente.fechaInicioCliente);
      if (fecha < inicio || fecha >= fin) return false;
    }
    if (filter.suspendidoPeriodo) {
      if (!cliente.vencidoDesde) return false;
      const { inicio, fin } = rangoDePeriodo(
        filter.suspendidoPeriodo.granularidad,
        new Date(filter.suspendidoPeriodo.referencia)
      );
      const fecha = new Date(cliente.vencidoDesde);
      if (fecha < inicio || fecha >= fin) return false;
    }
    return true;
  });
}

function compareBy(field: ClientesSortField, a: PostVentaCliente, b: PostVentaCliente): number {
  switch (field) {
    case "nombreCliente":
      return a.nombreCliente.localeCompare(b.nombreCliente);
    case "deudaTotal":
      return a.deudaTotal - b.deudaTotal;
    case "antiguedadMeses":
      return (a.antiguedad.meses ?? -1) - (b.antiguedad.meses ?? -1);
    case "cantidadComprobantesHistorico":
      return a.cantidadComprobantesHistorico - b.cantidadComprobantesHistorico;
    case "estadoPostVentaEfectivo":
      return a.estadoPostVentaEfectivo.localeCompare(b.estadoPostVentaEfectivo);
    case "fechaOs":
      return (a.ordenVigente.fechaOs ?? "").localeCompare(b.ordenVigente.fechaOs ?? "");
    case "fechaInicioCliente":
      return (a.fechaInicioCliente ?? "").localeCompare(b.fechaInicioCliente ?? "");
    case "vencidoDesde":
      return (a.vencidoDesde ?? "").localeCompare(b.vencidoDesde ?? "");
    case "diasParaRenovacion":
      return (a.diasParaRenovacion ?? Infinity) - (b.diasParaRenovacion ?? Infinity);
    case "ingresosClienteMensual":
      return (
        (a.ordenVigente.postVentaExtra?.ingresosClienteMensual ?? -1) -
        (b.ordenVigente.postVentaExtra?.ingresosClienteMensual ?? -1)
      );
    case "diasSinActividad":
      return (a.diasSinActividad ?? -1) - (b.diasSinActividad ?? -1);
    default:
      return 0;
  }
}

export function queryClientes(
  clientes: PostVentaCliente[],
  options: ClientesQueryOptions
): ClientesQueryResult {
  const filtered = options.filter ? filterClientes(clientes, options.filter) : clientes.slice();

  if (options.sortBy) {
    const dir = options.sortDir === "desc" ? -1 : 1;
    filtered.sort((a, b) => dir * compareBy(options.sortBy as ClientesSortField, a, b));
  }

  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : 25;
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  return { data, page, pageSize, total: filtered.length };
}
