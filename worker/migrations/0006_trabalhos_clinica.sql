CREATE TABLE IF NOT EXISTS trabalhos_clinica (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  chave TEXT NOT NULL,
  referencia TEXT NOT NULL,
  tipo TEXT NOT NULL,
  prazo TEXT,
  observacoes TEXT NOT NULL DEFAULT '',
  concluido INTEGER NOT NULL DEFAULT 0 CHECK (concluido IN (0,1)),
  UNIQUE(usuario_id, chave)
);
CREATE INDEX IF NOT EXISTS idx_clinica_usuario_id ON trabalhos_clinica(usuario_id, id DESC);
