-- Fluxo Lab V5.9.0 — DESFAZER a migração de reconhecimentos
--
-- Remove somente a tabela e os índices criados pela V5.9.0. Nenhuma tabela de produção é tocada.
-- Faça backup antes. Os reconhecimentos registrados serão perdidos.

DROP INDEX IF EXISTS idx_emblemas_reconhec_v590_usuario_tipo;
DROP INDEX IF EXISTS ux_emblemas_reconhec_v590_ativo;
DROP TABLE IF EXISTS emblemas_reconhecimentos_v590;

-- OPCIONAL (descomente só se quiser apagar também os emblemas já gravados por esta versão):
-- DELETE FROM emblemas_conquistas_v325 WHERE codigo LIKE 'ORG\_%' ESCAPE '\';
