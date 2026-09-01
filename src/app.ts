import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.routes.js";
import { ordenesRouter } from "./routes/ordenes.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { postventaRouter } from "./routes/postventa.routes.js";
import { clientesRouter } from "./routes/clientes.routes.js";
import { notasRouter } from "./routes/notas.routes.js";
import { tareasRouter } from "./routes/tareas.routes.js";
import { alertasRouter } from "./routes/alertas.routes.js";
import { oportunidadesRouter } from "./routes/oportunidades.routes.js";
import { savedViewsRouter } from "./routes/savedViews.routes.js";
import { configRouter } from "./routes/config.routes.js";
import { interesesRouter } from "./routes/intereses.routes.js";
import { reunionesRouter } from "./routes/reuniones.routes.js";
import { historialRouter } from "./routes/historial.routes.js";
import { incidenciasRouter } from "./routes/incidencias.routes.js";
import { incidenciasManualesRouter } from "./routes/incidenciasManuales.routes.js";
import { contactosRouter } from "./routes/contactos.routes.js";
import { clientesBajaRouter } from "./routes/clientesBaja.routes.js";
import { seguimientoPostVentaRouter } from "./routes/seguimientoPostVenta.routes.js";

export const app = express();

app.use(
  cors({
    origin: env.frontendOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/ordenes", ordenesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/postventa", postventaRouter);
app.use("/api/clientes", clientesRouter);
app.use("/api/notas", notasRouter);
app.use("/api/tareas", tareasRouter);
app.use("/api/alertas", alertasRouter);
app.use("/api/oportunidades", oportunidadesRouter);
app.use("/api/saved-views", savedViewsRouter);
app.use("/api/config", configRouter);
app.use("/api/intereses", interesesRouter);
app.use("/api/reuniones", reunionesRouter);
app.use("/api/historial-seguimiento", historialRouter);
app.use("/api/incidencias", incidenciasRouter);
app.use("/api/incidencias-manuales", incidenciasManualesRouter);
app.use("/api/contactos", contactosRouter);
app.use("/api/clientes-baja", clientesBajaRouter);
app.use("/api/seguimiento-postventa", seguimientoPostVentaRouter);

app.use(errorHandler);
