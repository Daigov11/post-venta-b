-- Amplia el alcance de operativo.fecha_corte_historico: ya no es solo para
-- incidencias/documentacion (0037), ahora tambien filtra TODAS las alertas
-- globales (deuda, certificado, documentacion, renovacion, etc.) en
-- GET /api/alertas, cola urgente, contadores del Dashboard y
-- metadata.alertasCount (Cartera/Tareas/Renovaciones) — usando
-- ordenVigente.fechaSistema como campo de corte. La ficha del cliente sigue
-- sin filtrar (decision de negocio, 2026-09-21). El valor del corte no
-- cambia, solo se actualiza la descripcion para reflejar el alcance real.
UPDATE postventa_config
SET descripcion = 'Corte para vistas globales de alertas (Alertas/Dashboard/cola urgente/contadores): clientes/sistemas con ordenVigente.fechaSistema anterior a este valor no generan alerta ahi. Ficha del cliente no se filtra. Nunca se borra ni se resuelve nada.'
WHERE config_key = 'operativo.fecha_corte_historico';
