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
  segmento?: string;
  // Filtro dedicado para el item 17 del spec — usa el mismo booleano
  // precalculado que la alerta RENOVACION_PROXIMA (ver facturacion.ts).
  renovacionProxima?: boolean;
}

export type ClientesSortField =
  | "nombreCliente"
  | "deudaTotal"
  | "antiguedadMeses"
  | "cantidadComprobantesHistorico"
  | "estadoPostVentaEfectivo"
  | "fechaOs"
  | "diasParaRenovacion";

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
  if (cliente.telefono?.toLowerCase().includes(needle)) return true;
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
    if (filter.segmento && cliente.segmentoEfectivo !== filter.segmento) return false;
    if (filter.renovacionProxima !== undefined) {
      if (cliente.renovacionEnAlerta !== filter.renovacionProxima) return false;
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
    case "diasParaRenovacion":
      return (a.diasParaRenovacion ?? Infinity) - (b.diasParaRenovacion ?? Infinity);
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
