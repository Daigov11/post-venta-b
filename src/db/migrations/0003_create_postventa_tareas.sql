CREATE TABLE postventa_tareas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  numero_documento_cliente VARCHAR(20) NOT NULL,
  id_orden_servicio BIGINT UNSIGNED NULL,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT NULL,
  responsable VARCHAR(150) NOT NULL,
  prioridad ENUM('BAJA', 'MEDIA', 'ALTA') NOT NULL DEFAULT 'MEDIA',
  estado ENUM('PENDIENTE', 'EN_PROCESO', 'ESPERANDO_CLIENTE', 'COMPLETADA', 'CANCELADA')
    NOT NULL DEFAULT 'PENDIENTE',
  fecha_vencimiento DATE NULL,
  created_by VARCHAR(150) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cliente (numero_documento_cliente),
  KEY idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
