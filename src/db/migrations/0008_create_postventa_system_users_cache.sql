-- Cache de la cantidad de "trabajadores" de cada cliente, aproximada por la
-- cantidad de usuarios registrados en su propio sistema (endpoint
-- Administrativo/systemUser). Nunca se guarda la clave (password) de esos
-- usuarios, solo el nombre de usuario y el conteo.
CREATE TABLE postventa_system_users_cache (
  numero_documento_cliente VARCHAR(20) NOT NULL,
  cantidad_trabajadores INT NOT NULL DEFAULT 0,
  usuarios JSON NOT NULL,
  link_sistema_usado VARCHAR(500) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (numero_documento_cliente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
