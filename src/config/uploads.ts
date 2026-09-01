import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Fuera de src/ y dist/ a proposito — un archivo subido no debe desaparecer
// en el proximo `npm run build` (que reescribe dist/ entero). Misma
// profundidad relativa en dev (tsx, corre desde src/config) y en prod
// (node, corre desde dist/config), asi que "../../uploads" siempre resuelve
// a la raiz del proyecto.
const here = path.dirname(fileURLToPath(import.meta.url));
export const uploadsRootDir = path.join(here, "..", "..", "uploads");
export const adjuntosDir = path.join(uploadsRootDir, "adjuntos");

fs.mkdirSync(adjuntosDir, { recursive: true });
