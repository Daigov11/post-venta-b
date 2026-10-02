-- Separa dos conceptos que hoy viven mezclados en la sola columna "tipo"
-- (MANUAL/RENOVACION): TIPO (naturaleza de la tarea: cobranza, renovacion,
-- documentacion, soporte, seguimiento, reunion, oportunidad comercial) vs
-- ORIGEN (como se creo: manual, alerta, incidencia, ficha_cliente,
-- oportunidad, renovacion) + una referencia de origen (tipo de entidad + id)
-- para poder volver a la incidencia/alerta/oportunidad que la genero.
--
-- Auditoria previa (2026-09-XX, ver historial de la conversacion): 385
-- tareas en total — 384 tipo=RENOVACION (100% generadas por
-- sincronizarTareasRenovacion, created_by='Sistema', todas con
-- id_orden_servicio) y 1 sola tipo=MANUAL (titulo "Seguimiento incidencia:
-- DOCUMENTOS RECHAZADOS", creada a mano desde la ficha del cliente sin
-- guardar el vinculo real a la incidencia). No hay forma de saber con
-- certeza a que incidencia se referia esa unica tarea MANUAL, asi que NO se
-- reclasifica como SOPORTE ni se le inventa una referencia de origen — pasa
-- a "PENDIENTE_CLASIFICACION" (tipo) con origen=MANUAL, tal como estaba,
-- sin perder ningun dato.
--
-- Orden seguro (ensanchar el enum antes de escribir los valores nuevos,
-- angostarlo despues de que ya no quede ninguna fila con el valor viejo):
--
-- ROLLBACK MANUAL (no hay mecanismo de "down" en este proyecto — si alguna
-- vez hay que revertir, corre esto a mano):
--   ALTER TABLE postventa_tareas MODIFY COLUMN tipo ENUM('MANUAL','RENOVACION') NOT NULL DEFAULT 'MANUAL';
--   UPDATE postventa_tareas SET tipo = 'MANUAL' WHERE tipo NOT IN ('RENOVACION');
--   DROP INDEX idx_origen ON postventa_tareas;
--   ALTER TABLE postventa_tareas DROP COLUMN origen, DROP COLUMN origen_entidad_tipo, DROP COLUMN origen_entidad_id;

-- 1) Nuevas columnas de origen — puramente aditivo, no toca "tipo" todavia.
ALTER TABLE postventa_tareas
  ADD COLUMN origen ENUM('MANUAL', 'ALERTA', 'INCIDENCIA', 'FICHA_CLIENTE', 'OPORTUNIDAD', 'RENOVACION')
    NOT NULL DEFAULT 'MANUAL' AFTER tipo,
  ADD COLUMN origen_entidad_tipo VARCHAR(40) NULL AFTER origen,
  ADD COLUMN origen_entidad_id VARCHAR(64) NULL AFTER origen_entidad_tipo;

-- 2) Backfill de origen usando el tipo actual, ANTES de tocar el enum de
-- tipo — las RENOVACION ya tienen evidencia solida (generadas por el
-- sistema, siempre con cliente + orden de servicio conocidos).
UPDATE postventa_tareas
  SET origen = 'RENOVACION', origen_entidad_tipo = 'CLIENTE', origen_entidad_id = numero_documento_cliente
  WHERE tipo = 'RENOVACION';
-- Las MANUAL quedan con origen='MANUAL' (el DEFAULT) y sin entidad de
-- origen — no hay como reconstruir de donde vinieron exactamente.

-- 3) Ensanchar el enum de "tipo": deja conviviendo los valores viejos
-- (MANUAL, RENOVACION) con los nuevos mientras se migra la data.
ALTER TABLE postventa_tareas
  MODIFY COLUMN tipo ENUM(
    'MANUAL', 'RENOVACION', 'PENDIENTE_CLASIFICACION',
    'COBRANZA', 'DOCUMENTACION', 'SOPORTE', 'SEGUIMIENTO', 'REUNION', 'OPORTUNIDAD_COMERCIAL'
  ) NOT NULL DEFAULT 'PENDIENTE_CLASIFICACION';

-- 4) Reclasificar SOLO con evidencia real: MANUAL -> PENDIENTE_CLASIFICACION.
-- RENOVACION ya es un tipo valido y correcto, se queda igual.
UPDATE postventa_tareas SET tipo = 'PENDIENTE_CLASIFICACION' WHERE tipo = 'MANUAL';

-- 5) Angostar el enum: "MANUAL" ya no es un valor valido de tipo (ahora vive
-- unicamente en "origen") — a esta altura ya no queda ninguna fila con
-- tipo='MANUAL'.
ALTER TABLE postventa_tareas
  MODIFY COLUMN tipo ENUM(
    'RENOVACION', 'PENDIENTE_CLASIFICACION',
    'COBRANZA', 'DOCUMENTACION', 'SOPORTE', 'SEGUIMIENTO', 'REUNION', 'OPORTUNIDAD_COMERCIAL'
  ) NOT NULL DEFAULT 'PENDIENTE_CLASIFICACION';

CREATE INDEX idx_origen ON postventa_tareas (origen);
CREATE INDEX idx_origen_entidad ON postventa_tareas (origen_entidad_tipo, origen_entidad_id);
