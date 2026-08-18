import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { env } from "../config/env.js";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

async function run() {
  const connection = await mysql.createConnection({
    host: env.mysql.host,
    port: env.mysql.port,
    user: env.mysql.user,
    password: env.mysql.password,
    database: env.mysql.database,
    multipleStatements: true,
  });

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(80) NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [appliedRows] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT id FROM schema_migrations"
    );
    const applied = new Set(appliedRows.map((row) => row.id as string));

    const files = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`- ${file} (ya aplicada)`);
        continue;
      }

      const sql = readFileSync(join(migrationsDir, file), "utf-8");
      await connection.beginTransaction();
      try {
        await connection.query(sql);
        await connection.query("INSERT INTO schema_migrations (id) VALUES (?)", [file]);
        await connection.commit();
        console.log(`+ ${file} aplicada`);
      } catch (error) {
        await connection.rollback();
        throw new Error(`Fallo aplicando ${file}: ${(error as Error).message}`);
      }
    }
  } finally {
    await connection.end();
  }
}

run()
  .then(() => {
    console.log("Migraciones al dia.");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
