CREATE TABLE clinica_pacientes (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  nome TEXT NOT NULL,
  chave TEXT NOT NULL,
  UNIQUE(usuario_id,chave)
);
CREATE INDEX idx_clinica_pacientes_nome ON clinica_pacientes(usuario_id,nome COLLATE NOCASE);
ALTER TABLE trabalhos_clinica ADD COLUMN paciente_id INTEGER REFERENCES clinica_pacientes(id);
ALTER TABLE trabalhos_clinica ADD COLUMN dentes TEXT NOT NULL DEFAULT '';
ALTER TABLE trabalhos_clinica ADD COLUMN andamento INTEGER NOT NULL DEFAULT 0 CHECK(andamento BETWEEN 0 AND 8);
UPDATE trabalhos_clinica SET andamento=8 WHERE concluido=1;
