import { refreshAll } from "./src/controllers/systemUsers.controller.js";
import { env } from "./src/config/env.js";

async function main() {
  const inicio = Date.now();
  console.log("Arrancando refresh de usuarios de sistema para toda la cartera...");

  const req = { externalToken: env.fallbackApiToken } as any;
  const res = {
    status() { return this; },
    json(body: any) {
      const segundos = Math.round((Date.now() - inicio) / 1000);
      console.log(`Terminado en ${segundos}s:`, JSON.stringify(body));
    },
  } as any;

  await refreshAll(req, res);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
