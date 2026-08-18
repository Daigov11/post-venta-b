import { app } from "./app.js";
import { env } from "./config/env.js";
import { runDailySync } from "./services/postventa/postventaCache.js";
import { iniciarSchedulerDiario } from "./services/postventa/scheduler.js";

// Todo el calculo de ciclos de facturacion (segmento, renovacion, vencidos)
// usa metodos de fecha en hora LOCAL del proceso (setDate/setMonth/getDate),
// no UTC — necesitan coincidir con la hora de Peru, donde vive el negocio y
// sus clientes. El script npm ya fija TZ=America/Lima; esto es una segunda
// red de seguridad por si el proceso arranca de otra forma (ej. un gestor de
// procesos en produccion que no pase por "npm run").
if (!process.env.TZ) {
  process.env.TZ = "America/Lima";
}

async function start() {
  try {
    await runDailySync();
    console.log("Sync inicial del dataset compartido completado.");
  } catch (error) {
    console.error(
      "No se pudo completar el sync inicial (se reintentara en el primer request que lo necesite):",
      error
    );
  }

  iniciarSchedulerDiario();

  app.listen(env.port, () => {
    console.log(`Backend escuchando en http://localhost:${env.port}`);
  });
}

start();
