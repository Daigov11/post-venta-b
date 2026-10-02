-- Guarda solo lo minimo necesario para resolver idPersona de forma segura al
-- crear un seguimiento, sin depender de nada editable por el cliente ni
-- guardar el JWT ni un hash simple del mismo. La clave es
-- HMAC-SHA-256(SESSION_HMAC_SECRET, token) — un secreto que solo conoce el
-- servidor, nunca el JWT en si ni un hash reproducible sin ese secreto.
-- expira_en se alinea al "exp" del propio JWT (misma vida util que la sesion
-- real en APIWorking, nunca mas).
CREATE TABLE postventa_sesion_apiworking (
  token_hmac CHAR(64) NOT NULL,
  id_persona VARCHAR(30) NOT NULL,
  usuario VARCHAR(150) NOT NULL,
  expira_en DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hmac),
  KEY idx_expira_en (expira_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
