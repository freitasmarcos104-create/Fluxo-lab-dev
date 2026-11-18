import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { cadastrarCursoAnatomia, renderCheckpointAnatomia } from "../worker/modules/curso-anatomia.js";

function criarBanco() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE universidade_cursos_v321 (id INTEGER PRIMARY KEY, titulo, descricao, categoria, nivel,
      carga_horaria_minutos, nota_aprovacao, ativo, criado_por, criado_em, atualizado_em);
    CREATE TABLE universidade_aulas_v321 (curso_id, titulo, resumo, conteudo, video_url, material_url,
      ordem, duracao_minutos, ativo, criado_em);
    CREATE TABLE universidade_questoes_v321 (id INTEGER PRIMARY KEY, curso_id, pergunta, ordem, ativo, criado_em);
    CREATE TABLE universidade_alternativas_v321 (questao_id, texto, ordem, correta);
    CREATE TABLE universidade_competencias_v321 (id INTEGER PRIMARY KEY, nome TEXT UNIQUE, ativo, criado_em);
    CREATE TABLE universidade_curso_competencias_v321 (curso_id, competencia_id, UNIQUE(curso_id, competencia_id));
  `);
  const db = {
    prepare(sql) {
      return { bind: (...args) => ({ sql, args, first: async () => sqlite.prepare(sql).get(...args) }) };
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        for (const { sql, args } of statements) sqlite.prepare(sql).run(...args);
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { sqlite, db };
}

test("cadastra o curso completo uma única vez, inclusive com pedidos simultâneos", async () => {
  const { sqlite, db } = criarBanco();
  const cadastrar = () => cadastrarCursoAnatomia(db, 1, "2026-11-18T12:00:00.000Z");
  assert.deepEqual((await Promise.all([cadastrar(), cadastrar()])).sort(), [false, true]);
  const cursos = sqlite.prepare("SELECT carga_horaria_minutos, nota_aprovacao, ativo FROM universidade_cursos_v321").all();
  assert.equal(cursos.length, 1);
  assert.equal(cursos[0].carga_horaria_minutos, 103);
  assert.equal(cursos[0].nota_aprovacao, 70);
  assert.equal(cursos[0].ativo, 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM universidade_aulas_v321").get().n, 9);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM universidade_curso_competencias_v321").get().n, 3);
  const alternativas = sqlite.prepare("SELECT COUNT(*) AS n, SUM(correta) AS certas FROM universidade_alternativas_v321 GROUP BY questao_id").all();
  assert.equal(alternativas.length, 10);
  assert.ok(alternativas.every(({ n, certas }) => n === 4 && certas === 1));
  assert.equal((renderCheckpointAnatomia(String).match(/<fieldset/g) || []).length, 5);
});

test("um erro na gravação impede a publicação parcial", async () => {
  const { sqlite, db } = criarBanco();
  sqlite.exec("DROP TABLE universidade_alternativas_v321");
  await assert.rejects(cadastrarCursoAnatomia(db, 1, "2026-11-18T12:00:00.000Z"), /no such table/);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM universidade_cursos_v321").get().n, 0);
});
