import type { ClienteBase, OsRefNormalized } from "../types/postventa.js";
import { parseDmyDate } from "./enrichment/dateParsing.js";

// Preferir una OS que NO este en estado excluido (ej. "CLIENTE DE BAJA") por
// sobre una que si lo esta, aunque la excluida sea mas reciente — un cliente
// con otra OS activa no deberia desaparecer de la lista normal solo porque
// abrio una OS separada que despues se dio de baja. La fecha mas reciente
// solo desempata dentro del mismo grupo (todas activas o todas excluidas).
function pickOrdenVigente(
  osRefs: OsRefNormalized[],
  estadosExcluidos: string[]
): OsRefNormalized {
  const activas = osRefs.filter(
    (os) => !estadosExcluidos.includes(os.nEstadoApiWorking.trim().toUpperCase())
  );
  const candidatos = activas.length > 0 ? activas : osRefs;
  return candidatos.reduce((vigente, current) => {
    if (!current.fechaOs) return vigente;
    if (!vigente.fechaOs) return current;
    return current.fechaOs > vigente.fechaOs ? current : vigente;
  }, candidatos[0]);
}

function pickFechaInicioMasAntigua(osRefs: OsRefNormalized[]): string | null {
  let masAntigua: { raw: string; parsed: Date } | null = null;
  for (const os of osRefs) {
    const parsed = parseDmyDate(os.pruebaFechaInicio);
    if (!parsed) continue;
    if (!masAntigua || parsed.getTime() < masAntigua.parsed.getTime()) {
      masAntigua = { raw: os.pruebaFechaInicio as string, parsed };
    }
  }
  return masAntigua?.raw ?? null;
}

// Agrupa por numeroDocumentoCliente: un cliente puede tener multiples Ordenes
// de Servicio. idOrdenServicio/numeroOs de cada una se conservan en osRefs,
// nunca se descartan.
export function groupOrdenesByCliente(
  rows: OsRefNormalized[],
  estadosExcluidos: string[]
): ClienteBase[] {
  const groups = new Map<string, OsRefNormalized[]>();
  for (const row of rows) {
    const existing = groups.get(row.numeroDocumentoCliente);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(row.numeroDocumentoCliente, [row]);
    }
  }

  const clientes: ClienteBase[] = [];
  for (const [numeroDocumentoCliente, osRefs] of groups) {
    const osRefsOrdenados = [...osRefs].sort((a, b) => {
      if (!a.fechaOs) return 1;
      if (!b.fechaOs) return -1;
      return b.fechaOs.localeCompare(a.fechaOs);
    });
    const ordenVigente = pickOrdenVigente(osRefsOrdenados, estadosExcluidos);
    const deudaTotal = osRefsOrdenados.reduce((sum, os) => sum + os.deuda, 0);

    clientes.push({
      numeroDocumentoCliente,
      nombreCliente: ordenVigente.nombreCliente,
      telefono: ordenVigente.telefono,
      nUbigeo: ordenVigente.nUbigeo,
      pruebaFechaInicio: pickFechaInicioMasAntigua(osRefsOrdenados),
      ordenVigente,
      osRefs: osRefsOrdenados,
      deudaTotal,
    });
  }

  return clientes;
}
