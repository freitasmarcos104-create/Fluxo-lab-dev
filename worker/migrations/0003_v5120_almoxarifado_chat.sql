-- Fluxo Lab V5.12.0 — chat da equipe do Almoxarifado
-- Migração aditiva: cria somente o histórico do canal reservado ao Almoxarifado.

CREATE TABLE IF NOT EXISTS almoxarifado_chat_mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  mensagem TEXT NOT NULL CHECK (
    length(trim(mensagem)) BETWEEN 1 AND 1500
  ),
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_almox_chat_data
  ON almoxarifado_chat_mensagens(id DESC);

CREATE INDEX IF NOT EXISTS idx_almox_chat_usuario_data
  ON almoxarifado_chat_mensagens(usuario_id,id DESC);
