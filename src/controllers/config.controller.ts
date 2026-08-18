import type { Request, Response } from "express";
import { getConfig, updateConfig } from "../services/postventa/configService.js";
import type { PostVentaConfigValues } from "../types/postventa.js";

export async function getConfigValues(_req: Request, res: Response) {
  const config = await getConfig();
  res.status(200).json(config);
}

export async function patchConfigValues(req: Request, res: Response) {
  const patch = req.body ?? {};
  const updated = await updateConfig(
    patch as Partial<Record<keyof PostVentaConfigValues, string>>,
    req.usuario as string
  );
  res.status(200).json(updated);
}
