-- Fluxo Lab V5.14.0 — estoques independentes e cadastro simplificado
-- Migração aditiva. Preserva itens, lotes e movimentos já registrados.
-- Todos os lotes existentes permanecem no estoque central do Almoxarifado.

ALTER TABLE almoxarifado_itens ADD COLUMN tipo_catalogo TEXT;

ALTER TABLE almoxarifado_lotes
  ADD COLUMN estoque TEXT NOT NULL DEFAULT 'ALMOXARIFADO'
  CHECK (estoque IN ('ALMOXARIFADO','IMPRESSAO'));

ALTER TABLE almoxarifado_lotes
  ADD COLUMN lote_origem_id INTEGER
  REFERENCES almoxarifado_lotes(id) ON DELETE RESTRICT;

CREATE INDEX idx_almox_lotes_estoque_item
  ON almoxarifado_lotes(estoque,item_id);

CREATE UNIQUE INDEX idx_almox_lote_origem_estoque
  ON almoxarifado_lotes(lote_origem_id,estoque)
  WHERE lote_origem_id IS NOT NULL;

-- Lote e validade passam a ser opcionais no cadastro/recebimento.
-- A rastreabilidade continua registrada quando esses dados são informados.
DROP TRIGGER IF EXISTS trg_almox_lote_exige_rastreio;
