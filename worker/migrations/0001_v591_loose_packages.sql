-- Fluxo Lab V5.9.1 — permitir pacotes sem paciente cadastrado.
--
-- D1 bloqueia ALTER COLUMN DROP NOT NULL via sqlite_drop_constraint.
-- Esta migração reconstrói o conjunto relacionado em uma única transação:
-- 1. Faz cópias dos dados e das sequências AUTOINCREMENT.
-- 2. Remove primeiro as três tabelas filhas e depois a tabela pai.
-- 3. Recria a tabela pai com trabalho_id opcional e a mesma FK para trabalhos.
-- 4. Recria as tabelas filhas, restaura todos os registros e índices.
-- 5. Restaura os valores de sqlite_sequence e remove as cópias temporárias.
--
-- Tabelas reconstruídas:
-- pacotes_arquivos_digitais
-- arquivos_pacotes_digitais
-- eventos_pacotes_digitais
-- downloads_pacotes_digitais
--
-- As FKs para trabalhos, remessas e usuarios continuam ativas.
-- Nenhum dado de negócio é intencionalmente descartado ou transformado.

CREATE TABLE __v591_backup_pacotes AS
SELECT * FROM pacotes_arquivos_digitais;

CREATE TABLE __v591_backup_arquivos AS
SELECT * FROM arquivos_pacotes_digitais;

CREATE TABLE __v591_backup_eventos AS
SELECT * FROM eventos_pacotes_digitais;

CREATE TABLE __v591_backup_downloads AS
SELECT * FROM downloads_pacotes_digitais;

CREATE TABLE __v591_backup_sequence AS
SELECT name, seq
FROM sqlite_sequence
WHERE name IN (
  'pacotes_arquivos_digitais',
  'arquivos_pacotes_digitais',
  'eventos_pacotes_digitais',
  'downloads_pacotes_digitais'
);

-- Remover todas as tabelas filhas antes da tabela pai evita referências pendentes.
DROP TABLE arquivos_pacotes_digitais;
DROP TABLE eventos_pacotes_digitais;
DROP TABLE downloads_pacotes_digitais;
DROP TABLE pacotes_arquivos_digitais;

-- Tabela pai: a única mudança estrutural é trabalho_id aceitar NULL.
CREATE TABLE pacotes_arquivos_digitais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trabalho_id INTEGER,
  remessa_id INTEGER,
  nome_pacote TEXT NOT NULL,
  setor_origem TEXT NOT NULL,
  setor_destino TEXT NOT NULL,
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'ATIVO',
  criado_por INTEGER NOT NULL,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  excluido_por INTEGER,
  excluido_em TEXT,
  motivo_exclusao TEXT,
  CHECK (setor_origem IN ('CAD/CAM','FATIAMENTO','IMPRESSAO','ACABAMENTO')),
  CHECK (setor_destino IN ('CAD/CAM','FATIAMENTO','IMPRESSAO','ACABAMENTO')),
  CHECK (setor_origem <> setor_destino),
  CHECK (status IN ('ATIVO','EXCLUIDO','CANCELADO')),
  FOREIGN KEY (trabalho_id) REFERENCES trabalhos(id),
  FOREIGN KEY (remessa_id) REFERENCES remessas(id),
  FOREIGN KEY (criado_por) REFERENCES usuarios(id),
  FOREIGN KEY (excluido_por) REFERENCES usuarios(id)
);

INSERT INTO pacotes_arquivos_digitais
SELECT * FROM __v591_backup_pacotes;

CREATE INDEX idx_pacotes_digitais_destino
  ON pacotes_arquivos_digitais(setor_destino,status,criado_em);

CREATE INDEX idx_pacotes_digitais_remessa
  ON pacotes_arquivos_digitais(remessa_id,status);

CREATE INDEX idx_pacotes_digitais_trabalho
  ON pacotes_arquivos_digitais(trabalho_id,status);

-- Arquivos ligados ao pacote.
CREATE TABLE arquivos_pacotes_digitais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pacote_id INTEGER NOT NULL,
  nome_original TEXT NOT NULL,
  caminho_relativo TEXT NOT NULL,
  extensao TEXT,
  mime_type TEXT,
  tamanho_bytes INTEGER NOT NULL,
  chave_r2 TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ATIVO',
  enviado_por INTEGER NOT NULL,
  enviado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  excluido_por INTEGER,
  excluido_em TEXT,
  motivo_exclusao TEXT,
  baixado_em TEXT,
  baixado_por INTEGER,
  CHECK (tamanho_bytes >= 0),
  CHECK (status IN ('PENDENTE','ATIVO','EXCLUIDO')),
  UNIQUE (pacote_id,caminho_relativo),
  FOREIGN KEY (pacote_id) REFERENCES pacotes_arquivos_digitais(id),
  FOREIGN KEY (enviado_por) REFERENCES usuarios(id),
  FOREIGN KEY (excluido_por) REFERENCES usuarios(id)
);

INSERT INTO arquivos_pacotes_digitais
SELECT * FROM __v591_backup_arquivos;

CREATE INDEX idx_arquivos_pacotes_pacote
  ON arquivos_pacotes_digitais(pacote_id,status);

CREATE INDEX idx_arquivos_pacotes_status
  ON arquivos_pacotes_digitais(status,enviado_em);

CREATE INDEX idx_arquivos_pacotes_tamanho
  ON arquivos_pacotes_digitais(tamanho_bytes);

-- Eventos e trilha de auditoria do pacote.
CREATE TABLE eventos_pacotes_digitais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pacote_id INTEGER NOT NULL,
  usuario_id INTEGER,
  evento TEXT NOT NULL,
  quantidade_arquivos INTEGER NOT NULL DEFAULT 0,
  tamanho_bytes INTEGER NOT NULL DEFAULT 0,
  detalhe TEXT,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (quantidade_arquivos >= 0),
  CHECK (tamanho_bytes >= 0),
  FOREIGN KEY (pacote_id) REFERENCES pacotes_arquivos_digitais(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

INSERT INTO eventos_pacotes_digitais
SELECT * FROM __v591_backup_eventos;

CREATE INDEX idx_eventos_pacotes_evento
  ON eventos_pacotes_digitais(evento,criado_em);

CREATE INDEX idx_eventos_pacotes_pacote
  ON eventos_pacotes_digitais(pacote_id,criado_em);

CREATE INDEX idx_eventos_pacotes_usuario
  ON eventos_pacotes_digitais(usuario_id,criado_em);

-- Histórico de downloads.
CREATE TABLE downloads_pacotes_digitais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pacote_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  tipo_download TEXT NOT NULL DEFAULT 'PACOTE_COMPLETO',
  quantidade_arquivos INTEGER NOT NULL DEFAULT 0,
  tamanho_total_bytes INTEGER NOT NULL DEFAULT 0,
  baixado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (tipo_download IN ('PACOTE_COMPLETO','ARQUIVO_INDIVIDUAL')),
  CHECK (quantidade_arquivos >= 0),
  CHECK (tamanho_total_bytes >= 0),
  FOREIGN KEY (pacote_id) REFERENCES pacotes_arquivos_digitais(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

INSERT INTO downloads_pacotes_digitais
SELECT * FROM __v591_backup_downloads;

CREATE INDEX idx_downloads_pacotes_pacote
  ON downloads_pacotes_digitais(pacote_id,baixado_em);

CREATE INDEX idx_downloads_pacotes_usuario
  ON downloads_pacotes_digitais(usuario_id,pacote_id,baixado_em);

-- Preservar a próxima numeração, mesmo quando os maiores IDs antigos foram apagados.
UPDATE sqlite_sequence
SET seq = (
  SELECT seq FROM __v591_backup_sequence
  WHERE name = sqlite_sequence.name
)
WHERE name IN (
  'pacotes_arquivos_digitais',
  'arquivos_pacotes_digitais',
  'eventos_pacotes_digitais',
  'downloads_pacotes_digitais'
)
AND EXISTS (
  SELECT 1 FROM __v591_backup_sequence
  WHERE name = sqlite_sequence.name
);

INSERT INTO sqlite_sequence(name,seq)
SELECT b.name,b.seq
FROM __v591_backup_sequence b
WHERE NOT EXISTS (
  SELECT 1 FROM sqlite_sequence s WHERE s.name=b.name
);

-- Remover cópias temporárias apenas depois de restaurar dados e índices.
DROP TABLE __v591_backup_pacotes;
DROP TABLE __v591_backup_arquivos;
DROP TABLE __v591_backup_eventos;
DROP TABLE __v591_backup_downloads;
DROP TABLE __v591_backup_sequence;
