ALTER TABLE postventa_tareas
  ADD COLUMN tipo ENUM('MANUAL', 'RENOVACION') NOT NULL DEFAULT 'MANUAL' AFTER id_orden_servicio;

CREATE INDEX idx_tipo_estado ON postventa_tareas (tipo, estado);
