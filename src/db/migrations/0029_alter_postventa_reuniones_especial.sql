ALTER TABLE postventa_reuniones
  MODIFY COLUMN fecha DATE NULL,
  MODIFY COLUMN hora_inicio TIME NULL,
  MODIFY COLUMN hora_fin TIME NULL,
  MODIFY COLUMN estado ENUM('PROGRAMADA', 'COMPLETADA', 'CANCELADA', 'EN_ESPERA')
    NOT NULL DEFAULT 'PROGRAMADA',
  ADD COLUMN tipo_reunion VARCHAR(100) NULL AFTER modalidad;

CREATE INDEX idx_estado ON postventa_reuniones (estado);
