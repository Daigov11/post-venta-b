CREATE TABLE postventa_tarea_seguimientos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tarea_id BIGINT UNSIGNED NOT NULL,
  usuario VARCHAR(150) NOT NULL,
  comentario TEXT NOT NULL,
  estado_en_ese_momento ENUM('PENDIENTE', 'EN_PROCESO', 'ESPERANDO_CLIENTE', 'COMPLETADA', 'CANCELADA') NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tarea (tarea_id),
  CONSTRAINT fk_seguimiento_tarea FOREIGN KEY (tarea_id)
    REFERENCES postventa_tareas (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
