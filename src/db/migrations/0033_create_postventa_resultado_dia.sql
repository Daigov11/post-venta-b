-- Modulo interno "Resultados y cierre diario" (Fase 3) — 100% local, no
-- depende de APIWorking. Cada usuario abre su propio dia (con un monto de
-- apertura en soles) y lo cierra explicitamente. A proposito NO existe
-- ninguna formula de "cuadre" (no hay monto de cierre ni diferencia
-- calculada) ni mensaje automatico de felicitacion: el "resultado" es la
-- observacion que la persona escribe al cerrar, y el aviso a administracion
-- es una casilla explicita que la misma persona marca — nunca una condicion
-- calculada sola. Ver Decisiones Fase 3 para el detalle de esta decision.
CREATE TABLE postventa_resultado_dia (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario VARCHAR(150) NOT NULL,
  fecha DATE NOT NULL,
  estado ENUM('ABIERTO', 'CERRADO') NOT NULL DEFAULT 'ABIERTO',
  monto_apertura DECIMAL(12, 2) NOT NULL,
  hora_apertura DATETIME NOT NULL,
  hora_cierre DATETIME NULL,
  observacion_cierre VARCHAR(1000) NULL,
  aviso_administracion TINYINT(1) NOT NULL DEFAULT 0,
  motivo_aviso VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_resultado_dia_usuario_fecha (usuario, fecha),
  KEY idx_resultado_dia_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Acciones realizadas/no realizadas por tipo. "tipo" es texto libre a
-- proposito: no existe un catalogo de tipos de accion confirmado con
-- negocio todavia, y no se inventa uno aca.
CREATE TABLE postventa_resultado_accion (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  resultado_dia_id BIGINT UNSIGNED NOT NULL,
  tipo VARCHAR(150) NOT NULL,
  realizadas INT NOT NULL DEFAULT 0,
  no_realizadas INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_resultado_accion_dia_tipo (resultado_dia_id, tipo),
  CONSTRAINT fk_resultado_accion_dia FOREIGN KEY (resultado_dia_id)
    REFERENCES postventa_resultado_dia (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conversiones — los 3 tipos son los confirmados explicitamente en el brief
-- (adquisicion de equipo, cambio de plan, adquisicion de modulo). A
-- diferencia de "acciones", aca si se fija un ENUM porque este conjunto de
-- 3 vino dado, no es un catalogo abierto inventado.
CREATE TABLE postventa_resultado_conversion (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  resultado_dia_id BIGINT UNSIGNED NOT NULL,
  tipo ENUM('EQUIPO', 'PLAN', 'MODULO') NOT NULL,
  cantidad INT NOT NULL DEFAULT 0,
  detalle VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_resultado_conversion_dia_tipo (resultado_dia_id, tipo),
  CONSTRAINT fk_resultado_conversion_dia FOREIGN KEY (resultado_dia_id)
    REFERENCES postventa_resultado_dia (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
