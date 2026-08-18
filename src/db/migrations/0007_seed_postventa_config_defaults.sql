INSERT INTO postventa_config (config_key, config_value, value_type, descripcion) VALUES
  ('estado.deuda_atencion_min', '0.01', 'NUMBER', 'Deuda total (S/) a partir de la cual el estado post venta pasa a ATENCION'),
  ('estado.documentacion_completa_min', '100', 'NUMBER', 'Porcentaje de documentacion por debajo del cual el estado post venta pasa a REVISAR'),
  ('alerta.deuda_min', '0.01', 'NUMBER', 'Deuda total (S/) a partir de la cual se genera una alerta de deuda pendiente'),
  ('alerta.antiguedad_aniversario_meses', '12', 'NUMBER', 'Cada cuantos meses de antiguedad se genera una alerta de aniversario'),
  ('oportunidad.cliente_antiguo_meses_min', '24', 'NUMBER', 'Meses de antiguedad minimos para considerar oportunidad de cliente antiguo'),
  ('oportunidad.alto_volumen_comprobantes_min', '500', 'NUMBER', 'Cantidad historica de comprobantes minima para considerar oportunidad de alto volumen'),
  ('sync.fecha_inicio', '2015-01-01', 'STRING', 'Fecha de inicio de la ventana usada para traer el dataset completo de ordenes de servicio');
