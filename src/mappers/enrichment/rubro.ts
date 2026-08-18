// Heuristica confirmada con el negocio: ciertas palabras clave delatan el
// rubro del cliente. Lista deliberadamente corta — se amplia a medida que se
// confirmen mas patrones reales, nunca se adivina un rubro no confirmado.
// Ej. "PLAN RESTO BASICO TRIMESTRAL 350" o baseDatos "prod_resto_restodelicado"
// -> Restaurante. Queda solo como fallback para OS anteriores a la fecha
// util del endpoint post-venta (ver nSistema mas abajo, que es autoritativo).
const RUBRO_KEYWORDS: { keyword: string; rubro: string }[] = [
  { keyword: "RESTO", rubro: "Restaurante" },
];

// nsistema del endpoint Administrativo/post-venta — dato real de APIWorking,
// no una heuristica. Valores confirmados vistos en produccion.
const N_SISTEMA_LABELS: Record<string, string> = {
  RESTAURANT: "Restaurante",
  TIENDAS: "Tienda",
  HOTEL: "Hotel",
};

function tituloDesde(texto: string): string {
  return texto
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(" ");
}

function matchKeyword(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const upper = texto.toUpperCase();
  for (const { keyword, rubro } of RUBRO_KEYWORDS) {
    if (upper.includes(keyword)) return rubro;
  }
  return null;
}

// Orden de confiabilidad: nSistema (endpoint post-venta) es un dato real
// declarado por APIWorking, no una adivinanza — tiene prioridad absoluta
// sobre las heuristicas. Si no viene (OS anteriores al 25-09-2022, fuera del
// rango util de ese endpoint), se cae a baseDatos del systemUser, luego el
// dominio del link, luego el nombre del plan.
export function parseRubro(fuentes: {
  nSistema?: string | null;
  baseDatos?: string | null;
  linkSistema?: string | null;
  nombrePlan?: string | null;
}): string {
  if (fuentes.nSistema) {
    const clave = fuentes.nSistema.trim().toUpperCase();
    if (clave) return N_SISTEMA_LABELS[clave] ?? tituloDesde(fuentes.nSistema.trim());
  }
  return (
    matchKeyword(fuentes.baseDatos) ??
    matchKeyword(fuentes.linkSistema) ??
    matchKeyword(fuentes.nombrePlan) ??
    "No determinado"
  );
}
