export interface UbigeoParsed {
  departamento: string;
  provincia: string;
  distrito: string;
}

// "DEPARTAMENTO AREQUIPA / AREQUIPA / JOSE LUIS BUSTAMANTE Y RIVERO" ->
// { departamento: "AREQUIPA", provincia: "AREQUIPA", distrito: "JOSE LUIS BUSTAMANTE Y RIVERO" }
// Si no calza con el formato esperado, se conserva el texto original (nunca se descarta el dato).
export function parseUbigeo(nUbigeo: string | null): UbigeoParsed | { raw: string } | null {
  if (!nUbigeo || !nUbigeo.trim()) return null;

  const parts = nUbigeo
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 3) {
    return { raw: nUbigeo };
  }

  const departamento = parts[0].replace(/^DEPARTAMENTO\s+/i, "");
  return { departamento, provincia: parts[1], distrito: parts[2] };
}
