import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  handleTrabalhosMunicipais, lerTrabalhosMunicipais, listarPecasMunicipais,
  painelPecasMunicipaisDesignadas, renderPecasMunicipais, sqlPecasMunicipaisConcluidas
} from "../worker/modules/trabalhos-municipais.js";
import { renderPainelProtesesRemessaV515 } from "../worker/modules/remessas-proteses.js";

test("aceita três trabalhos na mesma arcada e preserva o cadastro tradicional", () => {
  const form = new FormData();
  for (const tipo of ["PLACA_BRUXISMO", "PPR", "COROA", "COROA"]) form.append("inferior_tipo", tipo);
  const selecao = lerTrabalhosMunicipais(form);
  assert.equal(selecao.porPeca, true);
  assert.deepEqual(selecao.itens, ["PLACA_BRUXISMO", "PPR", "COROA"].map(tipo => ({ arcada: "INFERIOR", tipo })));
  form.set("inferior_tipo", "PPR");
  form.set("superior_tipo", "PT");
  assert.equal(lerTrabalhosMunicipais(form).porPeca, false);
  form.set("inferior_tipo", "INVALIDO");
  assert.equal(lerTrabalhosMunicipais(form), null);
  const html = renderPainelProtesesRemessaV515([{
    id: 1, paciente: "Paciente", superior_tipo: "NONE", inferior_tipo: "NONE",
    tipos_inferior: selecao.itens.map(({ tipo }) => tipo).join(",")
  }], 1);
  assert.match(html, /Placa de bruxismo · PPR · Coroa/);
});

test("somente o ADM libera cada peça, e a remessa aguarda a conclusão de todas", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE trabalhos (id INTEGER PRIMARY KEY, remessa_id, excluido, entregue, arquivado, paciente);
    CREATE TABLE remessas (id INTEGER PRIMARY KEY, data_finalizacao, data_entrega_real, municipio, numero);
    CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nome, perfil, ativo, excluido);
    CREATE TABLE usuario_areas (usuario_id, area, ativo);
    CREATE TABLE usuario_setores (usuario_id, area, ativo);
    INSERT INTO remessas VALUES (1, NULL, NULL, 'Mato Verde', 1);
    INSERT INTO trabalhos VALUES (1, 1, 0, 0, 0, 'Paciente');
    INSERT INTO usuarios VALUES (1, 'ADM', 'ADMINISTRADOR', 1, 0), (2, 'Gerente', 'GERENCIA', 1, 0),
      (3, 'Equipe 1', 'FUNCIONARIO', 1, 0), (4, 'Equipe 2', 'FUNCIONARIO', 1, 0);
    INSERT INTO usuario_areas VALUES (3, 'DIGITAL', 1), (4, 'DIGITAL', 1);
    INSERT INTO usuario_setores VALUES (3, 'DIGITAL', 1), (4, 'DIGITAL', 1);
  `);
  sqlite.exec(readFileSync(new URL("../worker/migrations/0009_trabalhos_municipais.sql", import.meta.url), "utf8"));
  sqlite.exec(`INSERT INTO trabalhos_municipais (trabalho_id, arcada, tipo) VALUES
    (1, 'INFERIOR', 'PLACA_BRUXISMO'), (1, 'INFERIOR', 'PPR'), (1, 'INFERIOR', 'COROA')`);

  const db = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return { bind: (...args) => ({
        first: () => statement.get(...args),
        all: () => ({ results: statement.all(...args) }),
        run: () => ({ meta: statement.run(...args) })
      }) };
    }
  };
  const usuario = id => sqlite.prepare("SELECT * FROM usuarios WHERE id = ?").get(id);
  const gerir = u => ["ADMINISTRADOR", "GERENCIA"].includes(u.perfil);
  const chamar = async (id, acao, autor, form) => {
    const caminho = `/trabalhos-municipais/${id}/${acao}`;
    const request = new Request("https://fluxolab.test" + caminho, {
      method: "POST", body: new URLSearchParams(form)
    });
    return (await handleTrabalhosMunicipais(request, { db }, caminho, {
      obterUsuarioLogado: async () => usuario(autor),
      redirect: destino => Response.redirect("https://fluxolab.test" + destino, 303),
      textResponse: (mensagem, status) => new Response(mensagem, { status }),
      isAdmin: u => u.perfil === "ADMINISTRADOR",
      podeGerirPecasMunicipais: gerir,
      usuarioTemAreaDigital: () => true,
      registrarHistorico: async () => {}
    })).status;
  };
  const ficha = async id => renderPecasMunicipais(await listarPecasMunicipais(db, 1), usuario(id), {
    ativo: true, gestao: gerir(usuario(id)), admin: id === 1, equipe: [usuario(3), usuario(4)], escapeHtml: String
  });
  const pronto = () => sqlite.prepare(`SELECT ${sqlPecasMunicipaisConcluidas("t")} AS pronto FROM trabalhos t`).get().pronto;

  assert.doesNotMatch(await ficha(3), /\/iniciar/);
  assert.equal(await chamar(1, "iniciar", 3), 403);
  assert.equal(await chamar(1, "designar", 2, { funcionario_id: "3" }), 403);
  assert.equal(await chamar(1, "designar", 1, { funcionario_id: "3" }), 303);
  assert.match(await ficha(3), /\/1\/iniciar/);
  assert.doesNotMatch(await ficha(3), /\/[23]\/iniciar/);
  assert.match(await painelPecasMunicipaisDesignadas(db, 3, String), /Placa de bruxismo/);
  assert.equal(await painelPecasMunicipaisDesignadas(db, 4, String), "");
  assert.equal(await chamar(1, "iniciar", 4), 403);
  assert.equal(await chamar(1, "concluir", 3), 409);
  assert.equal(await chamar(1, "iniciar", 3), 303);
  assert.equal(await chamar(1, "iniciar", 3), 409);
  assert.equal(await chamar(1, "designar", 1, { funcionario_id: "4", designado_anterior: "3" }), 409);
  assert.equal(await chamar(1, "concluir", 3), 303);
  assert.equal(pronto(), 0);

  for (const [peca, gestor] of [[2, 2], [3, 1]]) {
    assert.equal(await chamar(peca, "iniciar", gestor), 303);
    assert.equal(await chamar(peca, "concluir", gestor), 303);
  }
  assert.equal(pronto(), 1);
  assert.equal(await painelPecasMunicipaisDesignadas(db, 3, String), "");
  sqlite.close();
});
