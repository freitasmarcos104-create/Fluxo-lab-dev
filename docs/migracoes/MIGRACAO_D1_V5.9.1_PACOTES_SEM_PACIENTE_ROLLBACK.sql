-- Rollback V5.9.1 — restringe novamente trabalho_id.
--
-- ATENÇÃO: só executar depois de confirmar que NÃO EXISTE pacote com
-- trabalho_id IS NULL. Pacotes sem paciente precisam ser vinculados a um
-- trabalho real ou tratados antes do rollback.

ALTER TABLE pacotes_arquivos_digitais
  ALTER COLUMN trabalho_id SET NOT NULL;
