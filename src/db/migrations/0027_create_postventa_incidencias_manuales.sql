CREATE TABLE postventa_incidencias_manuales (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  numero_documento_cliente VARCHAR(20) NOT NULL,
  id_orden_servicio BIGINT UNSIGNED NULL,
  caso VARCHAR(200) NOT NULL,
  tipo VARCHAR(100) NULL,
  descripcion TEXT NULL,
  created_by VARCHAR(150) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cliente (numero_documento_cliente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
