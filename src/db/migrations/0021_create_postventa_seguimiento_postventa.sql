CREATE TABLE postventa_seguimiento_cliente (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  numero_documento_cliente VARCHAR(20) NOT NULL UNIQUE,
  id_orden_servicio BIGINT UNSIGNED NOT NULL,
  fecha_inicio DATE NOT NULL,
  estado_pipeline ENUM('EN_PROCESO','EXITOSO','REQUIERE_ATENCION') NOT NULL DEFAULT 'EN_PROCESO',
  origen ENUM('AUTOMATICO','IMPORTADO_EXCEL') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE postventa_seguimiento_etapa (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  seguimiento_cliente_id BIGINT UNSIGNED NOT NULL,
  etapa TINYINT NOT NULL,
  fecha_realizado DATE NULL,
  medio_comunicacion VARCHAR(100) NULL,
  estado_seguimiento VARCHAR(150) NULL,
  resumen TEXT NULL,
  solicitud_cliente TEXT NULL,
  usuario VARCHAR(150) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_cliente_etapa (seguimiento_cliente_id, etapa),
  CONSTRAINT fk_seguimiento_etapa_cliente FOREIGN KEY (seguimiento_cliente_id)
    REFERENCES postventa_seguimiento_cliente(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
