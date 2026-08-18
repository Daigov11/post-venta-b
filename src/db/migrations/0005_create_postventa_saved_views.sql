CREATE TABLE postventa_saved_views (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario VARCHAR(150) NOT NULL,
  screen VARCHAR(50) NOT NULL DEFAULT 'clientes',
  nombre VARCHAR(150) NOT NULL,
  columnas JSON NOT NULL,
  filtros JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuario_screen_nombre (usuario, screen, nombre),
  KEY idx_usuario (usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
