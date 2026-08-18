INSERT INTO postventa_config (config_key, config_value, value_type, descripcion) VALUES
  ('segmento.diamante_max_dias', '2', 'NUMBER', 'Dias de atraso maximos entre el vencimiento del ciclo y la factura para clasificar Diamante'),
  ('segmento.oro_max_dias', '5', 'NUMBER', 'Dias de atraso maximos para clasificar Oro'),
  ('segmento.plata_max_dias', '7', 'NUMBER', 'Dias de atraso maximos para clasificar Plata (mas que esto, o deuda pendiente, es Critico)');
