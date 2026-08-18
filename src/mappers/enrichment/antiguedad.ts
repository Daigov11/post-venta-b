import { parseDmyDate } from "./dateParsing.js";

function pluralize(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function calcularAntiguedad(
  pruebaFechaInicio: string | null,
  hoy: Date = new Date()
): { texto: string; meses: number } | { texto: "No determinado"; meses: null } {
  const inicio = parseDmyDate(pruebaFechaInicio);
  if (!inicio || inicio.getTime() > hoy.getTime()) {
    return { texto: "No determinado", meses: null };
  }

  let totalMeses =
    (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth());
  if (hoy.getDate() < inicio.getDate()) {
    totalMeses -= 1;
  }
  totalMeses = Math.max(0, totalMeses);

  const anos = Math.floor(totalMeses / 12);
  const mesesRestantes = totalMeses % 12;

  let texto: string;
  if (anos === 0) {
    texto = pluralize(mesesRestantes, "mes", "meses");
  } else if (mesesRestantes === 0) {
    texto = pluralize(anos, "año", "años");
  } else {
    texto = `${pluralize(anos, "año", "años")} ${pluralize(mesesRestantes, "mes", "meses")}`;
  }

  return { texto, meses: totalMeses };
}
