CREATE TABLE postventa_cliente_intereses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  numero_documento_cliente VARCHAR(20) NOT NULL,
  interes_id BIGINT UNSIGNED NOT NULL,
  marcado_por VARCHAR(150) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_cliente_interes (numero_documento_cliente, interes_id),
  KEY idx_cliente (numero_documento_cliente),
  CONSTRAINT fk_cliente_interes_catalogo FOREIGN KEY (interes_id)
    REFERENCES postventa_intereses_catalogo (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
