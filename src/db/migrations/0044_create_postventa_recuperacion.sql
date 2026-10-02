-- Modulo "Recuperacion de clientes" — la unidad de recuperacion es la orden
-- de servicio (id_orden_servicio), NUNCA el RUC: un mismo cliente puede
-- tener una orden activa y otra suspendida/de baja/en recuperacion al mismo
-- tiempo (ver auditoria previa — cero clientes tienen hoy mas de una orden
-- registrada en ninguna tabla local, pero el dataset en memoria si guarda
-- todas las ordenes de cada cliente, esta tabla es la primera en usarlas).
CREATE TABLE postventa_recuperacion_episodio (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_orden_servicio VARCHAR(60) NOT NULL,
  numero_documento_cliente VARCHAR(20) NOT NULL,
  -- Snapshot al crear el episodio — evita depender de un fetch a APIWorking
  -- solo para mostrar el nombre de episodios historicos ya cerrados.
  nombre_cliente VARCHAR(255) NOT NULL,
  origen ENUM('RENOVACION_IMPAGA', 'SUSPENSION', 'BAJA') NOT NULL,
  -- Permite reabrir un episodio nuevo para la misma orden+origen despues de
  -- un PERDIDO, conservando el anterior como historial — mismo patron que
  -- numero_apertura en postventa_bolsa_sesion (migracion 0041).
  numero_episodio INT NOT NULL DEFAULT 1,
  estado ENUM('EN_RECUPERACION', 'RECUPERADO', 'PERDIDO', 'PENDIENTE_VALIDACION') NOT NULL,
  -- NULL mientras el episodio esta PENDIENTE_VALIDACION sin fecha real
  -- confirmada (ver auditoria: no existe fecha real de suspension ni de baja
  -- cacheada en todos los casos) — nunca se inventa una fecha.
  fecha_ingreso DATE NULL,
  fecha_limite DATE NULL,
  -- Evidencia textual real disponible, nunca una afirmacion inventada (ej.
  -- "motivo no confirmado en el sistema" en vez de asumir falta de pago).
  motivo VARCHAR(500) NULL,
  responsable VARCHAR(150) NULL,
  resultado VARCHAR(500) NULL,
  fecha_recuperacion DATE NULL,
  fecha_perdida DATE NULL,
  creado_por VARCHAR(150) NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_episodio (id_orden_servicio, origen, numero_episodio),
  KEY idx_estado_limite (estado, fecha_limite),
  KEY idx_cliente (numero_documento_cliente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Config nueva — mismo patron que alerta.deuda_dias_max (migracion 0026).
-- dataset.estados_no_vigentes: lista mas amplia que dataset.estados_excluidos
-- (que solo saca clientes del dataset por completo) — usada unicamente para
-- que pickOrdenVigente() no elija una orden suspendida por sobre una orden
-- realmente activa del mismo cliente al desempatar por fecha. No excluye a
-- nadie del dataset, solo corrige el desempate.
INSERT INTO postventa_config (config_key, config_value, value_type, descripcion) VALUES
  ('dataset.estados_no_vigentes', 'CLIENTE DE BAJA,SUSPENDIDO POR PAGO', 'STRING',
   'Estados de APIWorking (nEstado) que nunca ganan el desempate de "orden vigente" frente a una orden realmente activa del mismo cliente — a diferencia de dataset.estados_excluidos, no saca al cliente del dataset.'),
  ('recuperacion.dias_gracia_renovacion', '4', 'NUMBER',
   'Dias de gracia despues de la fecha esperada de renovacion antes de considerar una orden "renovacion impaga" para el modulo de Recuperacion.'),
  ('recuperacion.dias_permanencia', '30', 'NUMBER',
   'Dias que un episodio de recuperacion permanece EN_RECUPERACION antes de marcarse PERDIDO automaticamente si nadie lo recupera.');

-- ROLLBACK MANUAL (no hay mecanismo de "down" en este proyecto):
--   DROP TABLE postventa_recuperacion_episodio;
--   DELETE FROM postventa_config WHERE config_key IN
--     ('dataset.estados_no_vigentes', 'recuperacion.dias_gracia_renovacion', 'recuperacion.dias_permanencia');
