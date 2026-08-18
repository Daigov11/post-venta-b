import { runDailySync } from "./postventaCache.js";

const UN_DIA_MS = 24 * 60 * 60 * 1000;

// Sin dependencia nueva: un setInterval alcanza para "una vez al dia" en un
// solo proceso de Node. Si el server se reinicia, el primer sync (llamado por
// separado antes de app.listen) ya deja el dataset tibio de entrada.
export function iniciarSchedulerDiario(): void {
  setInterval(() => {
    runDailySync().catch((error) => {
      console.error("Fallo el sync diario programado:", error);
    });
  }, UN_DIA_MS);
}
