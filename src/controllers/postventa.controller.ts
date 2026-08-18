import type { Request, Response } from "express";
import { runDailySync } from "../services/postventa/postventaCache.js";

export async function refresh(_req: Request, res: Response) {
  const dataset = await runDailySync();
  res.status(200).json({
    generatedAt: dataset.generatedAt,
    totalClientes: dataset.clientes.length,
    totalOsRows: dataset.totalOsRows,
  });
}
