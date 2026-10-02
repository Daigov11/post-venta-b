-- Usuarios que ejecutan el trabajo diario de Postventa (reparto de tareas
-- entre los tres, ver RESPONSABLES_REPARTO en repartoMensualContacto.ts).
-- Rol POSTVENTA. 'diegom' (ADMIN) y 'qa_test_postventa' ya existentes se
-- quedan, pero sin tareas asignadas: solo ven las tareas generales.
--
-- ROLLBACK MANUAL (no hay mecanismo de "down" en este proyecto):
--   DELETE FROM postventa_usuarios_autorizados
--   WHERE usuario_externo IN ('Cristian', 'Zurirodriguez', 'AISBELPV');
INSERT INTO postventa_usuarios_autorizados
  (usuario_externo, nombre_visible, rol, activo, creado_por)
VALUES
  ('Cristian', 'Cristian', 'POSTVENTA', 1, 'sistema (migracion 0046)'),
  ('Zurirodriguez', 'Zurirodriguez', 'POSTVENTA', 1, 'sistema (migracion 0046)'),
  ('AISBELPV', 'AISBELPV', 'POSTVENTA', 1, 'sistema (migracion 0046)');
