-- "La Bolsa" reemplaza conceptualmente al modulo Resultados (Fase 3,
-- postventa_resultado_dia/accion/conversion) — esas tablas NO se tocan ni se
-- borran, quedan como historial congelado. La diferencia clave: permite
-- multiples aperturas/cierres el mismo dia por usuario (pedido explicito),
-- por eso la clave unica es (usuario, fecha, numero_apertura) en vez de
-- (usuario, fecha). Los montos/contadores de logros NUNCA se guardan aca —
-- se calculan en vivo sobre datos reales (postventa_evento_operativo,
-- postventa_oportunidades_estado) en la ventana [abierta_en, cerrada_en o
-- ahora], para que nunca queden desactualizados respecto a la fuente real
-- (ver services/postventa/bolsaResumen.ts).
--
-- ROLLBACK MANUAL (no hay mecanismo de "down" en este proyecto):
--   DROP TABLE postventa_bolsa_accion;
--   DROP TABLE postventa_bolsa_sesion;
--   ALTER TABLE postventa_oportunidades_estado DROP COLUMN tipo, DROP COLUMN monto_real;
--   DELETE FROM postventa_config WHERE config_key = 'bolsa.admins';

CREATE TABLE postventa_bolsa_sesion (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario VARCHAR(150) NOT NULL,
  fecha DATE NOT NULL,
  numero_apertura INT NOT NULL,
  abierta_en DATETIME NOT NULL,
  cerrada_en DATETIME NULL,
  origen_apertura ENUM('AUTOMATICA', 'MANUAL') NOT NULL,
  origen_cierre ENUM('AUTOMATICA', 'MANUAL') NULL,
  observacion_cierre VARCHAR(1000) NULL,
  estado ENUM('ABIERTA', 'CERRADA') NOT NULL DEFAULT 'ABIERTA',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bolsa_sesion_usuario_fecha_apertura (usuario, fecha, numero_apertura),
  KEY idx_bolsa_sesion_usuario_estado (usuario, estado),
  KEY idx_bolsa_sesion_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registro manual de logros sin ningun campo real en el sistema (ej.
-- "recuperacion de cliente") — "tipo" es texto libre a proposito, mismo
-- criterio que postventa_resultado_accion.tipo: no existe un catalogo
-- cerrado confirmado con negocio para esto.
CREATE TABLE postventa_bolsa_accion (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bolsa_sesion_id BIGINT UNSIGNED NOT NULL,
  tipo VARCHAR(100) NOT NULL,
  descripcion VARCHAR(500) NULL,
  created_by VARCHAR(150) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bolsa_accion_sesion (bolsa_sesion_id),
  CONSTRAINT fk_bolsa_accion_sesion FOREIGN KEY (bolsa_sesion_id)
    REFERENCES postventa_bolsa_sesion (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ampliacion aditiva de postventa_oportunidades_estado: se llenan SOLO
-- cuando estado='GANADA'. tipo se copia del motor (oportunidades.engine.ts)
-- al momento de marcarla ganada, para poder sumar "la bolsa" por tipo sin
-- tener que re-evaluar todo el motor para historial pasado. monto_real es
-- opcional: se autocompleta con valorEstimado cuando el motor ya trae un
-- numero real (hoy solo MIGRACION_PERIODICIDAD); para el resto (ej.
-- VENTA_EQUIPO, que el motor marca "No determinado") queda NULL salvo que
-- la persona lo escriba a mano al marcarla ganada — nunca se inventa.
ALTER TABLE postventa_oportunidades_estado
  ADD COLUMN tipo VARCHAR(40) NULL AFTER estado,
  ADD COLUMN monto_real DECIMAL(10, 2) NULL AFTER tipo;

INSERT INTO postventa_config (config_key, config_value, value_type, descripcion) VALUES
  ('bolsa.admins', 'diegom', 'STRING',
   'Usuarios (separados por coma) que ven la bolsa de TODOS en vez de solo la propia. Primer concepto de rol/admin de la app — antes no existia ninguno.');
