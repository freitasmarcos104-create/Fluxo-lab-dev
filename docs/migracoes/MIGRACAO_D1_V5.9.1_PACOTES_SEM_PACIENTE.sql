-- Fluxo Lab V5.9.1 — permitir pacotes sem paciente cadastrado
--
-- O fluxo /arquivos-digitais/soltos já grava trabalho_id=NULL quando
-- o usuário informa um nome de paciente sem cadastro. As rotas de pacote
-- já reconhecem esse caso como pacote solto. O esquema original, porém,
-- manteve trabalho_id NOT NULL e bloqueava a criação no D1.
--
-- A alteração mantém a chave estrangeira para trabalhos(id): valores
-- não nulos continuam obrigados a apontar para um trabalho existente.
-- Somente NULL passa a representar uma entrega sem vínculo de paciente.
--
-- NÃO EXECUTAR sem backup verificado e aprovação da migração.
-- Não altera registros existentes. Não cria paciente ou trabalho fictício.

ALTER TABLE pacotes_arquivos_digitais
  ALTER COLUMN trabalho_id DROP NOT NULL;
