-- Fluxo Lab V5.10.0 — Almoxarifado
-- Migração aditiva. Não altera tabelas existentes nem dados atuais.
-- O saldo é derivado exclusivamente de almoxarifado_movimentos.
-- A equipe do Almoxarifado é independente dos setores de produção Digital/Convencional.

CREATE TABLE almoxarifado_equipe (
  usuario_id INTEGER PRIMARY KEY,
  funcao TEXT NOT NULL DEFAULT 'ALMOXARIFE' CHECK (funcao='ALMOXARIFE'),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
  atribuido_por INTEGER NOT NULL,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  FOREIGN KEY (atribuido_por) REFERENCES usuarios(id) ON DELETE RESTRICT
);

CREATE INDEX idx_almox_equipe_ativos ON almoxarifado_equipe(ativo,funcao);

CREATE TABLE almoxarifado_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('REAGENTE','PADRAO','CONSUMIVEL','KIT','VIDRARIA','EPI')),
  unidade TEXT NOT NULL CHECK (unidade IN ('mL','g','un')),
  local_padrao TEXT NOT NULL,
  quantidade_minima REAL NOT NULL DEFAULT 0 CHECK (quantidade_minima >= 0),
  controla_lote INTEGER NOT NULL DEFAULT 0 CHECK (controla_lote IN (0,1)),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
  criado_por INTEGER NOT NULL,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (tipo NOT IN ('REAGENTE','PADRAO','KIT') OR controla_lote=1),
  FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE RESTRICT
);

CREATE TABLE almoxarifado_lotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  codigo_lote TEXT NOT NULL,
  validade TEXT,
  localizacao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DISPONIVEL' CHECK (status IN ('DISPONIVEL','QUARENTENA','BLOQUEADO','VENCIDO')),
  fornecedor TEXT,
  documento_entrada TEXT,
  recebido_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por INTEGER NOT NULL,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (item_id,codigo_lote),
  FOREIGN KEY (item_id) REFERENCES almoxarifado_itens(id) ON DELETE RESTRICT,
  FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CHECK (validade IS NULL OR date(validade) IS NOT NULL)
);

CREATE TABLE almoxarifado_requisicoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitante_id INTEGER NOT NULL,
  setor TEXT NOT NULL,
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA','CANCELADA')),
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (solicitante_id) REFERENCES usuarios(id) ON DELETE RESTRICT
);

CREATE TABLE almoxarifado_requisicao_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requisicao_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  quantidade_solicitada REAL NOT NULL CHECK (quantidade_solicitada > 0),
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requisicao_id) REFERENCES almoxarifado_requisicoes(id) ON DELETE RESTRICT,
  FOREIGN KEY (item_id) REFERENCES almoxarifado_itens(id) ON DELETE RESTRICT
);

CREATE TABLE almoxarifado_movimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  lote_id INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA','SAIDA','PERDA','VENCIMENTO','TRANSFERENCIA','AJUSTE_POSITIVO','AJUSTE_NEGATIVO')),
  quantidade REAL NOT NULL CHECK (quantidade > 0),
  origem_tipo TEXT,
  origem_id TEXT,
  requisicao_item_id INTEGER,
  local_origem TEXT,
  local_destino TEXT,
  motivo TEXT,
  usuario_id INTEGER NOT NULL,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (tipo NOT IN ('AJUSTE_POSITIVO','AJUSTE_NEGATIVO') OR length(trim(COALESCE(motivo,''))) >= 4),
  CHECK (tipo NOT IN ('PERDA','VENCIMENTO') OR length(trim(COALESCE(motivo,''))) >= 4),
  CHECK (tipo <> 'TRANSFERENCIA' OR (length(trim(COALESCE(local_origem,''))) > 0 AND length(trim(COALESCE(local_destino,''))) > 0 AND local_origem <> local_destino)),
  CHECK (tipo = 'SAIDA' OR requisicao_item_id IS NULL),
  FOREIGN KEY (item_id) REFERENCES almoxarifado_itens(id) ON DELETE RESTRICT,
  FOREIGN KEY (lote_id) REFERENCES almoxarifado_lotes(id) ON DELETE RESTRICT,
  FOREIGN KEY (requisicao_item_id) REFERENCES almoxarifado_requisicao_itens(id) ON DELETE RESTRICT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
);

CREATE INDEX idx_almox_itens_ativos_nome ON almoxarifado_itens(ativo,nome);
CREATE INDEX idx_almox_lotes_item_status ON almoxarifado_lotes(item_id,status,validade);
CREATE INDEX idx_almox_movimentos_lote_data ON almoxarifado_movimentos(lote_id,id);
CREATE INDEX idx_almox_movimentos_item_data ON almoxarifado_movimentos(item_id,id);
CREATE INDEX idx_almox_movimentos_requisicao ON almoxarifado_movimentos(requisicao_item_id);
CREATE INDEX idx_almox_requisicoes_status ON almoxarifado_requisicoes(status,criado_em);
CREATE INDEX idx_almox_requisicoes_solicitante ON almoxarifado_requisicoes(solicitante_id,criado_em);

CREATE TRIGGER trg_almox_lote_exige_rastreio
BEFORE INSERT ON almoxarifado_lotes
WHEN (SELECT controla_lote FROM almoxarifado_itens WHERE id=NEW.item_id)=1
 AND (length(trim(NEW.codigo_lote))=0 OR NEW.validade IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'Item exige número de lote e validade.');
END;

CREATE TRIGGER trg_almox_movimento_lote_item
BEFORE INSERT ON almoxarifado_movimentos
WHEN NOT EXISTS (SELECT 1 FROM almoxarifado_lotes WHERE id=NEW.lote_id AND item_id=NEW.item_id)
BEGIN
  SELECT RAISE(ABORT, 'Lote não pertence ao item informado.');
END;

-- VENCIMENTO é a exceção dedicada ao descarte de lote que já expirou.
CREATE TRIGGER trg_almox_bloqueia_saida_lote
BEFORE INSERT ON almoxarifado_movimentos
WHEN NEW.tipo IN ('SAIDA','PERDA','VENCIMENTO','AJUSTE_NEGATIVO')
BEGIN
  SELECT CASE
    WHEN NEW.tipo='VENCIMENTO' AND NOT EXISTS (
      SELECT 1 FROM almoxarifado_lotes
      WHERE id=NEW.lote_id AND (status='VENCIDO' OR (validade IS NOT NULL AND validade < date('now')))
    ) THEN RAISE(ABORT, 'Baixa por vencimento exige lote vencido.')
    WHEN NEW.tipo='SAIDA' AND NOT EXISTS (
      SELECT 1 FROM almoxarifado_lotes
      WHERE id=NEW.lote_id AND status='DISPONIVEL' AND (validade IS NULL OR validade >= date('now'))
    ) THEN RAISE(ABORT, 'Lote vencido, em quarentena ou bloqueado não pode sair.')
    WHEN COALESCE((
      SELECT SUM(CASE
        WHEN tipo IN ('ENTRADA','AJUSTE_POSITIVO') THEN quantidade
        WHEN tipo IN ('SAIDA','PERDA','VENCIMENTO','AJUSTE_NEGATIVO') THEN -quantidade
        ELSE 0 END)
      FROM almoxarifado_movimentos WHERE lote_id=NEW.lote_id
    ),0) < NEW.quantidade THEN RAISE(ABORT, 'Saldo insuficiente no lote.')
  END;
END;

CREATE TRIGGER trg_almox_transferencia_integral
BEFORE INSERT ON almoxarifado_movimentos
WHEN NEW.tipo='TRANSFERENCIA'
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM almoxarifado_lotes
      WHERE id=NEW.lote_id AND status='DISPONIVEL'
        AND (validade IS NULL OR validade >= date('now'))
    ) THEN RAISE(ABORT, 'Somente lote disponível e válido pode ser transferido.')
    WHEN ABS(NEW.quantidade - COALESCE((
      SELECT SUM(CASE
        WHEN tipo IN ('ENTRADA','AJUSTE_POSITIVO') THEN quantidade
        WHEN tipo IN ('SAIDA','PERDA','VENCIMENTO','AJUSTE_NEGATIVO') THEN -quantidade
        ELSE 0 END)
      FROM almoxarifado_movimentos WHERE lote_id=NEW.lote_id
    ),0)) > 0.000001 THEN RAISE(ABORT, 'A transferência deve mover o saldo integral do lote.')
  END;
END;

CREATE TRIGGER trg_almox_limite_atendimento
BEFORE INSERT ON almoxarifado_movimentos
WHEN NEW.requisicao_item_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NEW.tipo<>'SAIDA' THEN RAISE(ABORT, 'Requisição só pode ser atendida por saída.')
    WHEN NOT EXISTS (
      SELECT 1 FROM almoxarifado_requisicao_itens WHERE id=NEW.requisicao_item_id AND item_id=NEW.item_id
    ) THEN RAISE(ABORT, 'Item não corresponde à requisição.')
    WHEN (
      COALESCE((SELECT SUM(quantidade) FROM almoxarifado_movimentos WHERE requisicao_item_id=NEW.requisicao_item_id AND tipo='SAIDA'),0)
      + NEW.quantidade
    ) > (
      SELECT quantidade_solicitada FROM almoxarifado_requisicao_itens WHERE id=NEW.requisicao_item_id
    ) THEN RAISE(ABORT, 'Quantidade atendida ultrapassa o pedido.')
    WHEN EXISTS (
      SELECT 1 FROM almoxarifado_requisicoes r
      JOIN almoxarifado_requisicao_itens ri ON ri.requisicao_id=r.id
      WHERE ri.id=NEW.requisicao_item_id AND r.status='CANCELADA'
    ) THEN RAISE(ABORT, 'Requisição cancelada.')
  END;
END;

CREATE TRIGGER trg_almox_movimentos_nao_atualizar
BEFORE UPDATE ON almoxarifado_movimentos
BEGIN
  SELECT RAISE(ABORT, 'Movimentos do Almoxarifado são imutáveis.');
END;

CREATE TRIGGER trg_almox_movimentos_nao_apagar
BEFORE DELETE ON almoxarifado_movimentos
BEGIN
  SELECT RAISE(ABORT, 'Movimentos do Almoxarifado são imutáveis.');
END;

CREATE VIEW almoxarifado_saldos_lotes AS
SELECT
  l.id AS lote_id,l.item_id,l.codigo_lote,l.validade,l.localizacao,l.status AS status_lote,
  l.fornecedor,l.documento_entrada,l.recebido_em,
  COALESCE(SUM(CASE
    WHEN m.tipo IN ('ENTRADA','AJUSTE_POSITIVO') THEN m.quantidade
    WHEN m.tipo IN ('SAIDA','PERDA','VENCIMENTO','AJUSTE_NEGATIVO') THEN -m.quantidade
    ELSE 0 END),0) AS saldo
FROM almoxarifado_lotes l
LEFT JOIN almoxarifado_movimentos m ON m.lote_id=l.id
GROUP BY l.id;

CREATE VIEW almoxarifado_saldos_itens AS
SELECT i.id AS item_id,i.codigo,i.nome,i.tipo,i.unidade,i.quantidade_minima,
  COALESCE(SUM(s.saldo),0) AS saldo_total,
  COALESCE(SUM(CASE
    WHEN s.status_lote='DISPONIVEL' AND (s.validade IS NULL OR s.validade >= date('now'))
    THEN s.saldo ELSE 0 END),0) AS saldo_disponivel
FROM almoxarifado_itens i
LEFT JOIN almoxarifado_saldos_lotes s ON s.item_id=i.id
WHERE i.ativo=1
GROUP BY i.id;

CREATE VIEW almoxarifado_status_requisicoes AS
SELECT r.id AS requisicao_id,
  CASE
    WHEN r.status='CANCELADA' THEN 'CANCELADA'
    WHEN COUNT(ri.id)=0 THEN 'ABERTA'
    WHEN COALESCE(SUM(COALESCE(b.quantidade_atendida,0)),0)>=COALESCE(SUM(ri.quantidade_solicitada),0) THEN 'ATENDIDA'
    WHEN COALESCE(SUM(COALESCE(b.quantidade_atendida,0)),0)>0 THEN 'PARCIAL'
    ELSE 'ABERTA'
  END AS status
FROM almoxarifado_requisicoes r
LEFT JOIN almoxarifado_requisicao_itens ri ON ri.requisicao_id=r.id
LEFT JOIN (
  SELECT requisicao_item_id,SUM(quantidade) AS quantidade_atendida
  FROM almoxarifado_movimentos
  WHERE tipo='SAIDA' AND requisicao_item_id IS NOT NULL
  GROUP BY requisicao_item_id
) b ON b.requisicao_item_id=ri.id
GROUP BY r.id;
