-- Fluxo Lab V5.13.0
-- Remove apenas a tabela paralela vazia criada pela V5.12.0.
-- O Chat Geral continua utilizando o histórico original chat_equipe_digital.
DROP INDEX IF EXISTS idx_almox_chat_data;
DROP INDEX IF EXISTS idx_almox_chat_usuario_data;
DROP TABLE IF EXISTS almoxarifado_chat_mensagens;
