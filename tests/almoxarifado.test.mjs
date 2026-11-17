import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { escaparHtmlAlmox, sinalMovimentoAlmox, handleAlmoxarifado } from "../worker/modules/almoxarifado.js";

test("Almoxarifado escapa texto antes de inserir dados no HTML", () => {
  assert.equal(escaparHtmlAlmox("<script>&\"'"), "&lt;script&gt;&amp;&quot;&#39;");
});

test("sinal do movimento preserva o saldo derivado do livro de movimentos", () => {
  assert.equal(sinalMovimentoAlmox("ENTRADA"), 1);
  assert.equal(sinalMovimentoAlmox("AJUSTE_POSITIVO"), 1);
  assert.equal(sinalMovimentoAlmox("SAIDA"), -1);
  assert.equal(sinalMovimentoAlmox("PERDA"), -1);
  assert.equal(sinalMovimentoAlmox("VENCIMENTO"), -1);
  assert.equal(sinalMovimentoAlmox("TRANSFERENCIA"), 0);
});

test("rota do Almoxarifado não libera acesso sem sessão", async () => {
  const env = { db: { prepare() { return { bind() { return this; }, first: async () => null }; } } };
  const response = await handleAlmoxarifado(
    new Request("https://app.markfree.com.br/almoxarifado"),
    env,
    new URL("https://app.markfree.com.br/almoxarifado")
  );
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/");
});

test("migração protege saldo, validade e imutabilidade no próprio D1", async () => {
  const sql = await readFile(new URL("../worker/migrations/0002_v5100_almoxarifado.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE VIEW almoxarifado_saldos_lotes/);
  assert.match(sql, /Saldo insuficiente no lote/);
  assert.match(sql, /Lote vencido, em quarentena ou bloqueado não pode sair/);
  assert.match(sql, /trg_almox_movimentos_nao_atualizar/);
  assert.match(sql, /trg_almox_movimentos_nao_apagar/);
  assert.match(sql, /trg_almox_limite_atendimento/);
  assert.doesNotMatch(sql, /CREATE TABLE[^;]*saldo\s+REAL/i);
});

test("ponto de entrada intercepta somente o Almoxarifado e preserva o Worker legado", async () => {
  const source = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");
  assert.match(source, /import legado from "\.\/legacy\.js"/);
  assert.match(source, /return handleAlmoxarifado/);
  assert.match(source, /legado\.fetch\(request, env, ctx\)/);
  assert.match(source, /injetarLinkAlmoxarifado/);
});
