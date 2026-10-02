-- Gestion manual de oportunidades (estado/responsable/siguiente accion/
-- resultado) — las oportunidades en si NO se guardan (se recalculan cada
-- request, ver oportunidades.engine.ts), solo este override, indexado por el
-- mismo id deterministico que genera el motor. Mismo patron que
-- postventa_alertas_estado (migracion 0030): sin fila = sin gestionar
-- (ABIERTA por defecto), la fila solo aparece cuando alguien la edita.
CREATE TABLE postventa_oportunidades_estado (
  oportunidad_id VARCHAR(300) NOT NULL,
  numero_documento_cliente VARCHAR(20) NOT NULL,
  estado ENUM('ABIERTA', 'EN_GESTION', 'GANADA', 'PERDIDA') NOT NULL DEFAULT 'ABIERTA',
  responsable VARCHAR(150) NULL,
  siguiente_accion VARCHAR(500) NULL,
  resultado VARCHAR(500) NULL,
  usuario VARCHAR(150) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (oportunidad_id),
  KEY idx_cliente (numero_documento_cliente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
