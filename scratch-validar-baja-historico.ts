import { listClientesBaja } from "./src/controllers/clientesBaja.controller.js";
import { pool } from "./src/config/db.js";

function mockRes() {
  return {
    status() { return this; },
    json(b: any) {
      const conHistorico = b.data.filter((r: any) => r.historico !== null);
      console.log("Total en pagina:", b.data.length, "-> con historico:", conHistorico.length);
      if (conHistorico[0]) console.log(JSON.stringify(conHistorico[0], null, 2));
    },
  } as any;
}

async function main() {
  // Buscar en que pagina cae alguno de los 68 importados, probando varias
  const [rows]: any = await pool.query("SELECT numero_documento_cliente FROM postventa_baja_historico LIMIT 1");
  console.log("Cliente de prueba:", rows[0].numero_documento_cliente);

  for (let page = 1; page <= 60; page++) {
    let found = false;
    await listClientesBaja(
      { query: { page: String(page), pageSize: "20" } } as any,
      {
        status() { return this; },
        json(b: any) {
          if (b.data.some((r: any) => r.numeroDocumentoCliente === rows[0].numero_documento_cliente)) {
            found = true;
            const match = b.data.find((r: any) => r.numeroDocumentoCliente === rows[0].numero_documento_cliente);
            console.log(`Encontrado en pagina ${page}:`, JSON.stringify(match, null, 2));
          }
        },
      } as any
    );
    if (found) break;
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
