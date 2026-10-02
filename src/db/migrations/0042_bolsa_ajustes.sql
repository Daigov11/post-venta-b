-- Ajustes sobre "La Bolsa" (feedback tras la primera version, migracion 0041):
--
-- 1) Se retira el concepto de superadmin (bolsa.admins) — no se introduce un
--    rol nuevo sin decision explicita. Se borra el config seed de 0041; no
--    habia ninguna tabla de usuarios ni permiso real construido sobre esto,
--    asi que no queda nada mas que limpiar.
DELETE FROM postventa_config WHERE config_key = 'bolsa.admins';

-- 2) Conversiones de "logro libre" (antes texto libre en
--    postventa_bolsa_accion.tipo) pasan a categorias fijas. Se normaliza el
--    UNICO valor historico real (creado en pruebas QA, ver reporte de
--    entidades) al equivalente exacto ANTES de angostar el enum — nunca se
--    borra, se traduce. 'OTRO' se agrega como red de seguridad para
--    cualquier valor historico que no calce con las 6 categorias reales (no
--    aplica hoy, pero evita que una migracion futura con mas datos falle o
--    trunque silenciosamente algo que no se previo aca).
UPDATE postventa_bolsa_accion
  SET tipo = 'RECUPERACION_CLIENTE'
  WHERE tipo = 'Recuperación de cliente';

RENAME TABLE postventa_bolsa_accion TO postventa_bolsa_conversion;

ALTER TABLE postventa_bolsa_conversion
  MODIFY COLUMN tipo ENUM(
    'CAMBIO_PERIODICIDAD', 'ADQUISICION_EQUIPO', 'RECUPERACION_CLIENTE',
    'VENTA_PRODUCTO', 'APILOYALTY', 'APIREVIEW', 'OTRO'
  ) NOT NULL;

-- 3) "Monto real cobrado" nunca fue una cifra verificada (nadie concilia
--    contra un pago real en APIWorking) — se renombra a "declarado" en todo
--    el codigo, empezando por la columna, para que el nombre no siga
--    sugiriendo una certeza que no existe.
ALTER TABLE postventa_oportunidades_estado
  CHANGE COLUMN monto_real monto_declarado DECIMAL(10, 2) NULL;

-- ROLLBACK MANUAL (no hay mecanismo de "down" en este proyecto):
--   ALTER TABLE postventa_oportunidades_estado CHANGE COLUMN monto_declarado monto_real DECIMAL(10,2) NULL;
--   ALTER TABLE postventa_bolsa_conversion MODIFY COLUMN tipo VARCHAR(100) NOT NULL;
--   RENAME TABLE postventa_bolsa_conversion TO postventa_bolsa_accion;
--   INSERT INTO postventa_config (config_key, config_value, value_type, descripcion)
--     VALUES ('bolsa.admins', 'diegom', 'STRING', 'restaurado manualmente');
