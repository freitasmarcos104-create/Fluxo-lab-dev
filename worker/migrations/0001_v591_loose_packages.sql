-- Fluxo Lab V5.9.1 — pacotes sem paciente cadastrado
--
-- O pacote pode existir sem trabalho vinculado. Nesse caso trabalho_id=NULL.
-- A FK continua ativa para todos os valores não nulos.
--
-- Executada pelo comando versionado:
-- cf d1 migrations apply 1806ff34-36f6-4cfc-a6df-aa2f5e04b6c6 --dir migrations

ALTER TABLE pacotes_arquivos_digitais
  ALTER COLUMN trabalho_id DROP NOT NULL;
