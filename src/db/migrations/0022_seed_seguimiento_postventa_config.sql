INSERT INTO postventa_config (config_key, config_value, value_type, descripcion) VALUES
  ('seguimiento.dias_etapa2', '15', 'NUMBER', 'Dias desde la etapa 1 de seguimiento post venta para que corresponda la etapa 2.'),
  ('seguimiento.dias_etapa3', '30', 'NUMBER', 'Dias desde la etapa 2 de seguimiento post venta para que corresponda la etapa 3.'),
  ('seguimiento.fecha_corte_clientes_nuevos', '2026-07-04', 'STRING', 'Clientes con fechaInicioCliente a partir de esta fecha entran al flujo automatico de seguimiento post venta (Meta Team). Anteriores a esto ya fueron seguidos a mano, ver import del Excel de Ligia.');
