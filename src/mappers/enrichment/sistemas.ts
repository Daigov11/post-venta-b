import type { ClienteSistemas, OsRefResumen } from "../../types/postventa.js";

// Cada OS del cliente es en el fondo una orden de APIWorking (tipoOS
// "Vendedor") — el conteo de OS es lo que hace que el icono de APIWorking
// muestre "x2", "x3", etc. Algunos planes traen ademas un addon bundleado en
// el propio nombre del plan (ej. "PLAN COMBO APILOYALTI", "DON CHAT ZERO
// MENSUAL") — eso es lo unico que tenemos como señal real hoy para
// APILoyalty/DonChat; SIRE Contable, API Review y POS no aparecen en ningun
// nombre de plan real todavia, asi que quedan siempre en gris (nunca se
// inventa que un cliente los tiene).
export function calcularSistemas(osRefs: OsRefResumen[]): ClienteSistemas {
  let apiLoyalty = false;
  let donChat = false;

  for (const os of osRefs) {
    const plan = (os.nombrePlan ?? "").toUpperCase();
    if (plan.includes("LOYALT")) apiLoyalty = true;
    if (plan.includes("CHAT")) donChat = true;
  }

  return {
    apiWorking: osRefs.length,
    apiLoyalty,
    donChat,
    sireContable: false,
    apiReview: false,
    pos: false,
  };
}
