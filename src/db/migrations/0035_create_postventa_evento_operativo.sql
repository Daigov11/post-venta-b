-- Registro automatico y trazable de acciones operativas reales (llamadas,
-- tareas, alertas resueltas, incidencias, seguimientos, oportunidades,
-- conversiones, apertura/cierre de dia) — nunca clics de navegacion/filtros.
-- Alimenta el conteo automatico de "Resultados y cierre diario" sin
-- reemplazar el registro manual existente (postventa_resultado_accion).
CREATE TABLE postventa_evento_operativo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario VARCHAR(150) NOT NULL,
  tipo_accion VARCHAR(60) NOT NULL,
  modulo VARCHAR(60) NOT NULL,
  numero_documento_cliente VARCHAR(30) NULL,
  entidad_tipo VARCHAR(30) NULL,
  entidad_id VARCHAR(60) NULL,
  resultado VARCHAR(30) NOT NULL,
  detalle VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_usuario_fecha (usuario, created_at),
  KEY idx_tipo_accion (tipo_accion),
  KEY idx_cliente (numero_documento_cliente),
  KEY idx_entidad (entidad_tipo, entidad_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
