-- Fluxo Lab V5.9.0 — reconhecimentos concedidos por administradores
-- (base dos emblemas de organização e limpeza)
--
-- NÃO EXECUTAR sem: (1) backup do D1 (export ou Time Travel), (2) revisão humana,
-- (3) janela combinada. Este arquivo não é executado por nenhum workflow.
--
-- Migração ADITIVA: cria 1 tabela e 2 índices. Não altera nem apaga nenhuma tabela existente.
-- Desfazer: MIGRACAO_D1_V5.9.0_EMBLEMAS_RECONHECIMENTOS_ROLLBACK.sql

CREATE TABLE IF NOT EXISTS emblemas_reconhecimentos_v590 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'ABERTURA_BANCADA', 'FECHAMENTO_BANCADA', 'AUDITORIA_FERRAMENTAL', 'AUDITORIA_ESTOQUE',
    'DESCARTE_CORRETO', 'SEMANA_5S', 'AUDITORIA_MENSAL'
  )),
  data_referencia TEXT NOT NULL CHECK (length(data_referencia) = 10),
  setor TEXT NOT NULL DEFAULT '',
  observacao TEXT NOT NULL DEFAULT '',
  concedido_por INTEGER NOT NULL,
  criado_em TEXT NOT NULL,
  revogado_em TEXT,
  revogado_por INTEGER,
  motivo_revogacao TEXT NOT NULL DEFAULT '',
  CHECK (usuario_id <> concedido_por),
  CHECK (
    (revogado_em IS NULL AND revogado_por IS NULL)
    OR (revogado_em IS NOT NULL AND revogado_por IS NOT NULL)
  ),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  FOREIGN KEY (concedido_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
  FOREIGN KEY (revogado_por) REFERENCES usuarios(id) ON DELETE RESTRICT
);

-- Impede o mesmo reconhecimento ativo em duplicidade. Depois de revogado, pode ser concedido de novo.
CREATE UNIQUE INDEX IF NOT EXISTS ux_emblemas_reconhec_v590_ativo
  ON emblemas_reconhecimentos_v590 (usuario_id, tipo, data_referencia, setor)
  WHERE revogado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_emblemas_reconhec_v590_usuario_tipo
  ON emblemas_reconhecimentos_v590 (usuario_id, tipo, data_referencia);
