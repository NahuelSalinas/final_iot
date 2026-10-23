-- Esquema de la base (Neon / Postgres). Se corre una sola vez desde el SQL Editor de Neon.
CREATE TABLE IF NOT EXISTS partidas (
  id           BIGSERIAL PRIMARY KEY,
  creado       TIMESTAMPTZ NOT NULL DEFAULT now(),
  iniciales    CHAR(3)     NOT NULL,
  puntaje      INTEGER     NOT NULL,
  final        TEXT        NOT NULL CHECK (final IN ('bueno','justo','persiana','cierre')),
  tramos       SMALLINT    NOT NULL,
  relacion     SMALLINT    NOT NULL,
  segundos     INTEGER     NOT NULL,
  sellos_mal   SMALLINT    NOT NULL,
  rechazos_ok  SMALLINT    NOT NULL,
  rechazos_mal SMALLINT    NOT NULL,
  mates        SMALLINT    NOT NULL,
  derrames     SMALLINT    NOT NULL,
  papelitos    SMALLINT    NOT NULL
);

CREATE INDEX IF NOT EXISTS partidas_puntaje_idx ON partidas (puntaje DESC, creado ASC);
