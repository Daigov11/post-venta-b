import { pool } from "../src/config/db.js";
import { reasignarPendientesDelPeriodo } from "../src/services/postventa/repartoMensualContacto.js";

reasignarPendientesDelPeriodo("sistema (reasignar-reparto-diario)")
  .then((r) => console.log(r))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
