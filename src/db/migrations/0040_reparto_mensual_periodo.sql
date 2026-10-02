-- Ajuste del reparto mensual de contactos (feedback sobre 0039): la
-- idempotencia por mes dejaba de funcionar en cuanto una tarea se
-- redistribuia (su fecha_vencimiento cambia, pero el mes al que "pertenece"
-- el reparto no deberia cambiar). Se agrega periodo_reparto (YYYY-MM,
-- inmutable una vez creada la tarea) como la clave real de "a que mes
-- pertenece este reparto" — separada de fecha_vencimiento, que ahora SI
-- puede moverse (redistribucion) sin romper la deduplicacion.
--
-- Ademas se agrega una restriccion UNIQUE real a nivel de base de datos
-- (cliente + origen + periodo) — antes la deduplicacion vivia solo en la
-- aplicacion (SELECT antes de INSERT), sin ninguna garantia contra una
-- condicion de carrera. Solo aplica de forma util a origen=REPARTO_MENSUAL
-- (el unico que llena periodo_reparto); el resto de tareas quedan con
-- periodo_reparto NULL, y MySQL no aplica UNIQUE entre multiples NULL.
--
-- Backfill: las 1347 filas ya creadas por el sync anterior (0039) se les
-- asigna periodo_reparto segun el mes de su fecha_vencimiento actual — no
-- se borra ni se reinventa ninguna fila existente.
--
-- ROLLBACK MANUAL (no hay mecanismo de "down" en este proyecto):
--   ALTER TABLE postventa_tareas DROP INDEX uq_reparto_periodo, DROP COLUMN periodo_reparto;

ALTER TABLE postventa_tareas
  ADD COLUMN periodo_reparto CHAR(7) NULL AFTER origen_entidad_id;

UPDATE postventa_tareas
  SET periodo_reparto = DATE_FORMAT(fecha_vencimiento, '%Y-%m')
  WHERE origen = 'REPARTO_MENSUAL';

ALTER TABLE postventa_tareas
  ADD UNIQUE KEY uq_reparto_periodo (numero_documento_cliente, origen, periodo_reparto);
