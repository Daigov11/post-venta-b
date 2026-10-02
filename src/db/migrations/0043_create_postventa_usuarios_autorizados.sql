-- Tabla local de autorizacion para Plataforma Postventa. NUNCA guarda
-- contrasena: la identidad y credencial siguen siendo 100% de APIWorking
-- (login externo, ver auth.controller.ts); esta tabla solo decide SI ese
-- usuario externo ya autenticado puede entrar a Postventa y con que rol.
--
-- Coleccion utf8mb4_unicode_ci (misma que el resto del proyecto, ver
-- postventa_config en 0006) ya es case-insensitive: una UNIQUE KEY sobre
-- usuario_externo con esta collation ya rechaza 'DiegoM' si 'diegom'
-- existe, y una comparacion "=" en WHERE ya matchea sin distinguir
-- mayusculas/minusculas. El repositorio igual usa LOWER() como defensa
-- barata adicional.
CREATE TABLE postventa_usuarios_autorizados (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario_apiworking VARCHAR(100) NULL,
  usuario_externo VARCHAR(150) NOT NULL,
  nombre_visible VARCHAR(150) NOT NULL,
  rol ENUM('ADMIN', 'ADMINISTRATIVO', 'POSTVENTA') NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  ultimo_acceso_en DATETIME NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  creado_por VARCHAR(150) NOT NULL,
  actualizado_por VARCHAR(150) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_autorizados_usuario_externo (usuario_externo),
  KEY idx_usuarios_autorizados_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Primer registro ADMIN: identidad externa ya confirmada del administrador
-- inicial (usuario 'diegom' en APIWorking). Sin password, sin
-- id_usuario_apiworking (no se tiene ese id confirmado hoy — se puede
-- completar despues a mano o via el CRUD sin volver a tocar la migracion).
INSERT INTO postventa_usuarios_autorizados
  (usuario_externo, nombre_visible, rol, activo, creado_por)
VALUES
  ('diegom', 'Diego M.', 'ADMIN', 1, 'sistema (migracion 0043)');

-- ROLLBACK MANUAL (no hay mecanismo de "down" en este proyecto):
--   DROP TABLE postventa_usuarios_autorizados;
