import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { trabalhosClinica, tiposClinica } from "../worker/modules/trabalhos-clinica.js";

test("Cada conta vê e atualiza seus casos; repetir o envio não duplica o caso", async () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec("CREATE TABLE usuarios(id INTEGER PRIMARY KEY); INSERT INTO usuarios VALUES (1),(2)");
  sql.exec(readFileSync(new URL("../worker/migrations/0006_trabalhos_clinica.sql", import.meta.url), "utf8"));
  const db = {prepare(query) {
    const stmt = sql.prepare(query);
    return {bind(...args) { return {
      all: () => ({results: stmt.all(...args)}), run: () => ({meta:stmt.run(...args)})
    }; }};
  }};
  const origin = "https://example.test";
  const render = {layout: s => s, htmlResponse: (s,status) => new Response(s,{status}), escapeHtml: s => s.replaceAll("<","&lt;")};
  const chamar = (id, dados) => trabalhosClinica(new Request(origin + "/trabalhos-clinica", dados && {
    method:"POST", headers:{Origin:origin}, body:new URLSearchParams(dados)
  }), db, {id}, render);
  const novo = {acao:"criar",chave:crypto.randomUUID(),referencia:"Caso <teste>",tipo:"Onlay",prazo:"2026-11-18"};
  assert.equal(tiposClinica.length,9);
  assert.equal((await chamar(1,{...novo,prazo:"2026-02-30"})).status,400);
  assert.equal((await chamar(1,novo)).status,303);
  assert.equal((await chamar(1,novo)).status,303);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM trabalhos_clinica").get().n,1);
  const resposta = await chamar(1);
  assert.equal(resposta.headers.get("Cache-Control"),"private, no-store");
  assert.match(await resposta.text(),/Caso &lt;teste>[\s\S]*18\/11\/2026/);
  assert.doesNotMatch(await (await chamar(2)).text(),/Caso &lt;teste>/);
  const status = {acao:"status",id:"1",concluido:"1"};
  assert.equal((await chamar(2,status)).status,404);
  assert.equal((await chamar(1,status)).status,303);
  assert.match(await (await chamar(1)).text(),/Reabrir trabalho/);
  assert.equal((await chamar(1,{...status,concluido:"0"})).status,303);
  assert.match(await (await chamar(1)).text(),/Marcar como concluído/);
  sql.close();
});
