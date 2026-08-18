export interface DocumentacionResumen {
  disponibles: number;
  total: number;
  porcentaje: number;
}

// existeFile1..4 son CONTEOS (no booleanos): > 0 significa "disponible".
export function calcularDocumentacion(row: {
  existeFile1: number;
  existeFile2: number;
  existeFile3: number;
  existeFile4: number;
}): DocumentacionResumen {
  const flags = [row.existeFile1, row.existeFile2, row.existeFile3, row.existeFile4];
  const disponibles = flags.filter((count) => count > 0).length;
  const total = flags.length;
  const porcentaje = total === 0 ? 0 : Math.round((disponibles / total) * 100);
  return { disponibles, total, porcentaje };
}
