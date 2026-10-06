-- Quien recibe el reparto diario de contactos pasa de estar fijo en codigo
-- (RESPONSABLES_REPARTO) a ser configurable por usuario desde el panel de
-- Configuracion. Aplica a cualquier rol: un ADMIN con recibe_reparto = 1
-- tambien recibe tareas (y ademas puede ver las de todos).
--
-- Backfill: quienes se reparten el trabajo (Cristian y AISBELPV; Zurirodriguez
-- queda fuera, confirmado con negocio) quedan activados.
--
-- ROLLBACK MANUAL (no hay mecanismo de "down" en este proyecto):
--   ALTER TABLE postventa_usuarios_autorizados DROP COLUMN recibe_reparto;

ALTER TABLE postventa_usuarios_autorizados
  ADD COLUMN recibe_reparto TINYINT(1) NOT NULL DEFAULT 0 AFTER activo;

UPDATE postventa_usuarios_autorizados
  SET recibe_reparto = 1
  WHERE usuario_externo IN ('Cristian', 'AISBELPV');
