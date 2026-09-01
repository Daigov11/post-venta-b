CREATE TABLE postventa_llamadas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  numero_documento_cliente VARCHAR(20) NOT NULL,
  id_orden_servicio BIGINT UNSIGNED NULL,
  usuario VARCHAR(150) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cliente (numero_documento_cliente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
