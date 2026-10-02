import { cerrarTodasAutomaticamente } from "./bolsaService.js";

// A diferencia del scheduler.ts existente (setInterval de 24h desde el
// arranque, sin hora fija), esto ancla a una hora exacta del dia: calcula
// cuanto falta para la proxima vez que sean las 19:00 y usa setTimeout,
// reprogramandose solo cada vez que dispara. TZ=America/Lima ya esta forzado
// a nivel de proceso (server.ts), asi que new Date() ya es hora de Lima.
const HORA_CIERRE = 19;
const MINUTO_CIERRE = 0;

function msHastaProximo(hora: number, minuto: number): number {
  const ahora = new Date();
  const objetivo = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate(),
    hora,
    minuto,
    0,
    0
  );
  if (objetivo.getTime() <= ahora.getTime()) {
    objetivo.setDate(objetivo.getDate() + 1);
  }
  return objetivo.getTime() - ahora.getTime();
}

function programarProximoCierre(): void {
  const espera = msHastaProximo(HORA_CIERRE, MINUTO_CIERRE);
  setTimeout(() => {
    cerrarTodasAutomaticamente()
      .then((cantidad) => {
        if (cantidad > 0) console.log(`Bolsa: cierre automático 7pm — ${cantidad} sesión(es) cerrada(s).`);
      })
      .catch((error) => {
        console.error("Fallo el cierre automático de la bolsa (7pm):", error);
      })
      .finally(() => {
        programarProximoCierre();
      });
  }, espera);
}

export function iniciarSchedulerBolsa(): void {
  programarProximoCierre();
}
