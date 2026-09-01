import type { ClaveDocumento, DocumentacionResumen } from "../../types/postventa.js";

// Orden fijo confirmado con el negocio — existeFile1 es siempre "Carta",
// existeFile2 siempre "Foto DNI", etc. No cambia por cliente ni por plan.
const DOCUMENTOS: { clave: ClaveDocumento; etiqueta: string }[] = [
  { clave: "CARTA", etiqueta: "Carta" },
  { clave: "FOTO_DNI", etiqueta: "Foto DNI" },
  { clave: "CLAVE_SOL", etiqueta: "Clave SOL" },
  { clave: "PAGOS", etiqueta: "Pagos" },
];

// existeFile1..4 son CONTEOS (no booleanos): > 0 significa "disponible".
export function calcularDocumentacion(row: {
  existeFile1: number;
  existeFile2: number;
  existeFile3: number;
  existeFile4: number;
}): DocumentacionResumen {
  const counts = [row.existeFile1, row.existeFile2, row.existeFile3, row.existeFile4];
  const detalle = DOCUMENTOS.map((doc, i) => ({ ...doc, disponible: counts[i] > 0 }));
  const disponibles = detalle.filter((d) => d.disponible).length;
  const total = detalle.length;
  const porcentaje = total === 0 ? 0 : Math.round((disponibles / total) * 100);
  return { disponibles, total, porcentaje, detalle };
}
