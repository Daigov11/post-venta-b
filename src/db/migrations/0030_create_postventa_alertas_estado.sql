CREATE TABLE postventa_alertas_estado (
  alerta_id VARCHAR(300) NOT NULL,
  numero_documento_cliente VARCHAR(20) NOT NULL,
  estado ENUM('VISTA', 'RESUELTA') NOT NULL,
  nota VARCHAR(500) NULL,
  usuario VARCHAR(150) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (alerta_id),
  KEY idx_cliente (numero_documento_cliente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
