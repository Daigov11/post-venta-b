-- Historial propio, liviano: una fila por cliente por dia. No es una copia
-- de la base de APIWorking (eso lo evitamos a proposito) — solo los campos
-- necesarios para poder calcular nosotros mismos cosas como "tiempo en el
-- estado actual" o "evolucion de deuda/segmento" sin depender de un endpoint
-- de historial que APIWorking todavia no tiene.
CREATE TABLE postventa_snapshots_diarios (
  numero_documento_cliente VARCHAR(20) NOT NULL,
  fecha_snapshot DATE NOT NULL,
  id_orden_servicio BIGINT UNSIGNED NULL,
  n_estado_api_working VARCHAR(150) NULL,
  deuda_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  segmento_calculado ENUM('DIAMANTE', 'ORO', 'PLATA', 'CRITICO') NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (numero_documento_cliente, fecha_snapshot),
  KEY idx_fecha (fecha_snapshot)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
