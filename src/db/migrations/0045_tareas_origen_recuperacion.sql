-- Nuevo origen de tarea: RECUPERACION. Permite crear tareas de seguimiento
-- desde un episodio del nuevo modulo de Recuperacion de clientes (accion
-- "Crear tarea" del ⚙), enlazadas via origenEntidadTipo=RECUPERACION_EPISODIO
-- / origenEntidadId=id del episodio. Puramente aditivo, ningun valor
-- existente de "origen" cambia.
--
-- ROLLBACK MANUAL (no hay mecanismo de "down" en este proyecto):
--   DELETE FROM postventa_tareas WHERE origen = 'RECUPERACION';
--   ALTER TABLE postventa_tareas
--     MODIFY COLUMN origen ENUM('MANUAL','ALERTA','INCIDENCIA','FICHA_CLIENTE','OPORTUNIDAD','RENOVACION','REPARTO_MENSUAL')
--     NOT NULL DEFAULT 'MANUAL';

ALTER TABLE postventa_tareas
  MODIFY COLUMN origen ENUM(
    'MANUAL', 'ALERTA', 'INCIDENCIA', 'FICHA_CLIENTE', 'OPORTUNIDAD', 'RENOVACION', 'REPARTO_MENSUAL', 'RECUPERACION'
  ) NOT NULL DEFAULT 'MANUAL';
