-- Nuevo origen de tarea: REPARTO_MENSUAL. Tareas de tipo SEGUIMIENTO
-- generadas automaticamente (sincronizarTareasRepartoMensual, mismo patron
-- que sincronizarTareasRenovacion) para repartir a TODOS los clientes
-- activos entre los dias habiles (lunes a sabado) del mes en curso, para
-- que cada uno reciba un contacto de seguimiento al menos una vez al mes.
-- Reparto parejo por numeroDocumentoCliente, sin ningun criterio de negocio
-- (confirmado explicitamente) — puramente aditivo, ningun valor existente
-- de "origen" cambia.
--
-- ROLLBACK MANUAL (no hay mecanismo de "down" en este proyecto):
--   DELETE FROM postventa_tareas WHERE origen = 'REPARTO_MENSUAL';
--   ALTER TABLE postventa_tareas
--     MODIFY COLUMN origen ENUM('MANUAL','ALERTA','INCIDENCIA','FICHA_CLIENTE','OPORTUNIDAD','RENOVACION')
--     NOT NULL DEFAULT 'MANUAL';

ALTER TABLE postventa_tareas
  MODIFY COLUMN origen ENUM(
    'MANUAL', 'ALERTA', 'INCIDENCIA', 'FICHA_CLIENTE', 'OPORTUNIDAD', 'RENOVACION', 'REPARTO_MENSUAL'
  ) NOT NULL DEFAULT 'MANUAL';
