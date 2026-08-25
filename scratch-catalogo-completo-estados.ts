import { getPostVentaDataset } from "./src/services/postventa/postventaCache.js";
import { fetchHistorialSeguimiento } from "./src/services/apiworking/externalApi.js";
import { mapHistorialSeguimientoItem, type RawHistorialSeguimientoItem } from "./src/mappers/historialSeguimiento.mapper.js";
import { env } from "./src/config/env.js";
import { runWithConcurrency } from "./src/utils/concurrency.js";

async function main() {
  const dataset = await getPostVentaDataset();
  const token = env.fallbackApiToken as string;

  console.log("=== nEstadoApiWorking (estado actual de la OS, dataset activo) ===");
  const porEstadoOS = new Map<string, number>();
  for (const c of dataset.clientes) {
    const e = c.ordenVigente.nEstadoApiWorking;
    porEstadoOS.set(e, (porEstadoOS.get(e) ?? 0) + 1);
  }
  console.log([...porEstadoOS.entries()].sort((a, b) => b[1] - a[1]));

  console.log("\nBarriendo historial-seguimiento de TODOS los clientes activos (puede tardar)...");
  const catalogo = new Map<number, Set<string>>();
  let ok = 0, fail = 0;
  await runWithConcurrency(dataset.clientes, 8, async (c) => {
    try {
      const raw: any = await fetchHistorialSeguimiento(token, { idOrdenServicio: c.ordenVigente.idOrdenServicio });
      const filas = Array.isArray(raw?.data) ? (raw.data as RawHistorialSeguimientoItem[]) : [];
      for (const f of filas) {
        const ev = mapHistorialSeguimientoItem(f);
        const set = catalogo.get(ev.idEstado) ?? new Set<string>();
        set.add(ev.estado);
        catalogo.set(ev.idEstado, set);
      }
      ok++;
    } catch {
      fail++;
    }
  });
  console.log(`OK: ${ok}, fail: ${fail}`);

  console.log("\n=== Catalogo COMPLETO (id_estado -> nestado) del historial de seguimiento ===");
  const entries = [...catalogo.entries()].sort((a, b) => a[0] - b[0]);
  for (const [id, set] of entries) {
    console.log(id, "->", [...set].join(" | "));
  }
  console.log("\nTotal id_estado distintos:", entries.length);

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
