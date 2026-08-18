CREATE TABLE postventa_reuniones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  numero_documento_cliente VARCHAR(20) NOT NULL,
  id_orden_servicio BIGINT UNSIGNED NULL,
  ejecutivo VARCHAR(150) NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  modalidad ENUM('VIRTUAL', 'PRESENCIAL') NOT NULL,
  lugar_o_link VARCHAR(300) NULL,
  nota TEXT NULL,
  estado ENUM('PROGRAMADA', 'COMPLETADA', 'CANCELADA') NOT NULL DEFAULT 'PROGRAMADA',
  created_by VARCHAR(150) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cliente (numero_documento_cliente),
  KEY idx_ejecutivo_fecha (ejecutivo, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
