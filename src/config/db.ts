import mysql from "mysql2/promise";
import { env } from "./env.js";

// Pool preparado para futuras features. No se usa todavia en login / ordenes,
// que por ahora dependen solo de la API externa.
export const pool = mysql.createPool({
  host: env.mysql.host,
  port: env.mysql.port,
  user: env.mysql.user,
  password: env.mysql.password,
  database: env.mysql.database,
  waitForConnections: true,
  connectionLimit: 10,
});
