import { TtlCache } from "../../config/cache.js";
import { env } from "../../config/env.js";
import * as configRepository from "../../repositories/config.repository.js";
import type { PostVentaConfigValues } from "../../types/postventa.js";

const DEFAULTS: PostVentaConfigValues = {
  "estado.deuda_atencion_min": 0.01,
  "estado.documentacion_completa_min": 100,
  "alerta.deuda_min": 0.01,
  "alerta.antiguedad_aniversario_meses": 12,
  "oportunidad.cliente_antiguo_meses_min": 24,
  "oportunidad.alto_volumen_comprobantes_min": 500,
  "sync.fecha_inicio": "2015-01-01",
  "dataset.estados_excluidos": "CLIENTE DE BAJA",
  "segmento.diamante_max_dias": 2,
  "segmento.oro_max_dias": 5,
  "segmento.plata_max_dias": 7,
  "sync.post_venta_fecha_inicio": "2022-09-25",
  "renovacion.alerta_mensual_dias": 7,
  "renovacion.alerta_trimestral_dias": 15,
  "renovacion.alerta_semestral_dias": 45,
  "renovacion.alerta_anual_dias": 45,
  "actividad.dias_sin_uso_alerta": 30,
};

const NUMERIC_KEYS: (keyof PostVentaConfigValues)[] = [
  "estado.deuda_atencion_min",
  "estado.documentacion_completa_min",
  "alerta.deuda_min",
  "alerta.antiguedad_aniversario_meses",
  "oportunidad.cliente_antiguo_meses_min",
  "oportunidad.alto_volumen_comprobantes_min",
  "segmento.diamante_max_dias",
  "segmento.oro_max_dias",
  "segmento.plata_max_dias",
  "renovacion.alerta_mensual_dias",
  "renovacion.alerta_trimestral_dias",
  "renovacion.alerta_semestral_dias",
  "renovacion.alerta_anual_dias",
  "actividad.dias_sin_uso_alerta",
];

const CACHE_KEY = "config";
const cache = new TtlCache<PostVentaConfigValues>(env.configCacheTtlMs);

export async function getConfig(): Promise<PostVentaConfigValues> {
  const cached = cache.get(CACHE_KEY);
  if (cached) return cached;

  const rows = await configRepository.findAll();
  const mutable: Record<string, unknown> = { ...DEFAULTS };

  for (const row of rows) {
    const key = row.key as keyof PostVentaConfigValues;
    if (!(key in mutable)) continue;
    mutable[key] = (NUMERIC_KEYS as string[]).includes(key) ? Number(row.value) : row.value;
  }

  const values = mutable as unknown as PostVentaConfigValues;
  cache.set(CACHE_KEY, values);
  return values;
}

export async function updateConfig(
  patch: Partial<Record<keyof PostVentaConfigValues, string>>,
  usuario: string
): Promise<PostVentaConfigValues> {
  await configRepository.upsertMany(patch, usuario);
  cache.invalidate(CACHE_KEY);
  return getConfig();
}
