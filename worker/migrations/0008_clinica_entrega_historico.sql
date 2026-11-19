ALTER TABLE trabalhos_clinica ADD COLUMN entregue_em TEXT;
ALTER TABLE trabalhos_clinica ADD COLUMN excluido_em TEXT;
ALTER TABLE clinica_pacientes ADD COLUMN excluido_em TEXT;
CREATE TABLE clinica_eventos (
  id INTEGER PRIMARY KEY,
  trabalho_id INTEGER NOT NULL REFERENCES trabalhos_clinica(id),
  evento TEXT NOT NULL,
  etapa INTEGER NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_clinica_evento_trabalho ON clinica_eventos(trabalho_id,id);
CREATE TRIGGER clinica_criado AFTER INSERT ON trabalhos_clinica BEGIN
  INSERT INTO clinica_eventos(trabalho_id,evento,etapa) VALUES(NEW.id,'criado',NEW.andamento);
END;
CREATE TRIGGER clinica_alterado AFTER UPDATE OF andamento,entregue_em,excluido_em ON trabalhos_clinica
WHEN NEW.andamento<>OLD.andamento OR NEW.entregue_em IS NOT OLD.entregue_em OR NEW.excluido_em IS NOT OLD.excluido_em BEGIN
  INSERT INTO clinica_eventos(trabalho_id,evento,etapa) VALUES(NEW.id,
    CASE WHEN NEW.excluido_em IS NOT OLD.excluido_em THEN 'excluido'
         WHEN NEW.entregue_em IS NOT OLD.entregue_em THEN 'entregue'
         WHEN NEW.andamento<OLD.andamento THEN 'reaberto'
         ELSE 'etapa' END, NEW.andamento);
END;
