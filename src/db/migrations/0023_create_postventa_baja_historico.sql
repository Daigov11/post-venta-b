CREATE TABLE postventa_baja_historico (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  numero_documento_cliente VARCHAR(20) NOT NULL UNIQUE,
  id_orden_servicio BIGINT UNSIGNED NOT NULL,
  fecha_baja_suspension DATE NULL,
  fecha_seguimiento DATE NULL,
  medio_comunicacion VARCHAR(150) NULL,
  resumen_seguimiento TEXT NULL,
  estado_seguimiento VARCHAR(150) NULL,
  estado_actual VARCHAR(150) NULL,
  observacion_encargado TEXT NULL,
  fecha_observacion_encargado DATE NULL,
  resumen_seguimiento_encargado TEXT NULL,
  fecha_seguimiento_encargado DATE NULL,
  estado_seguimiento_encargado VARCHAR(150) NULL,
  medio_comunicacion_encargado VARCHAR(150) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
