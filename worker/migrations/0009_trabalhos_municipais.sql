CREATE TABLE IF NOT EXISTS trabalhos_municipais (
  id INTEGER PRIMARY KEY,
  trabalho_id INTEGER NOT NULL REFERENCES trabalhos(id),
  arcada TEXT NOT NULL CHECK (arcada IN ('SUPERIOR', 'INFERIOR')),
  tipo TEXT NOT NULL CHECK (tipo IN ('PT', 'PPR', 'PLACA_BRUXISMO', 'COROA', 'INLAY', 'FACETA', 'PROTOCOLO')),
  designado_para INTEGER REFERENCES usuarios(id),
  designado_por INTEGER REFERENCES usuarios(id),
  designado_em TEXT,
  iniciado_por INTEGER REFERENCES usuarios(id),
  iniciado_em TEXT,
  concluido_por INTEGER REFERENCES usuarios(id),
  concluido_em TEXT,
  UNIQUE (trabalho_id, arcada, tipo)
);

CREATE INDEX IF NOT EXISTS idx_trabalhos_municipais_designado
  ON trabalhos_municipais (designado_para, concluido_em, trabalho_id);
