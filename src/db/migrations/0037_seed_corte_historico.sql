-- Corte entre "historial" y "trabajo activo": incidencias pendientes y
-- alertas de documentacion anteriores a esta fecha siguen visibles en la
-- ficha/historial del cliente, pero dejan de alimentar Dashboard, Alertas
-- activas, prioridades o Misiones de hoy. No borra ni marca nada como
-- resuelto — solo saca del flujo operativo diario lo que quedo obsoleto
-- antes de esta fecha (decision de negocio, 2026-09-21).
INSERT INTO postventa_config (config_key, config_value, value_type, descripcion) VALUES
  ('operativo.fecha_corte_historico', '2026-09-01', 'STRING',
   'Incidencias y alertas de documentacion anteriores a este corte dejan de alimentar Dashboard/Alertas/Tareas — siguen visibles solo en la ficha del cliente. Nunca se borran ni se marcan resueltas.');
