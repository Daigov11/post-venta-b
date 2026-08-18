-- infoClient.baseDatos del endpoint systemUser (ej. "prod_resto_restodelicado")
-- es una senal de rubro mas confiable que el nombre del plan.
ALTER TABLE postventa_system_users_cache
  ADD COLUMN base_datos VARCHAR(150) NULL AFTER cantidad_trabajadores;
