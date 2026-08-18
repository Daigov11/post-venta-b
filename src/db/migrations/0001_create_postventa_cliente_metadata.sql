CREATE TABLE postventa_cliente_metadata (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  numero_documento_cliente VARCHAR(20) NOT NULL,
  id_orden_servicio BIGINT UNSIGNED NULL,
  segmento_manual VARCHAR(50) NULL,
  estado_postventa_manual ENUM('NORMAL', 'REVISAR', 'ATENCION') NULL,
  etiquetas JSON NULL,
  observacion_general TEXT NULL,
  updated_by VARCHAR(150) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cliente_os (numero_documento_cliente, id_orden_servicio),
  KEY idx_cliente (numero_documento_cliente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
