import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  cabecalhosSegurancaV30,
  htmlResponse,
  textResponse,
  redirect,
  escapeHtml
} from '../worker/core/http.js';

test('escapeHtml neutraliza caracteres que formam markup', () => {
  assert.equal(
    escapeHtml("<script title='x'>&</script>"),
    '&lt;script title=&#039;x&#039;&gt;&amp;&lt;/script&gt;'
  );
  assert.equal(
    escapeHtml('"texto"'),
    '&quot;texto&quot;'
  );
});

test('htmlResponse aplica status, tipo e headers de segurança', async () => {
  const response = htmlResponse('<h1>Fluxo Lab</h1>', 201);
  assert.equal(response.status, 201);
  assert.match(response.headers.get('content-type') || '', /text\/html/);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(await response.text(), '<h1>Fluxo Lab</h1>');
});

test('textResponse mantém resposta textual sem cache', async () => {
  const response = textResponse('indisponível', 503);
  assert.equal(response.status, 503);
  assert.match(response.headers.get('content-type') || '', /text\/plain/);
  assert.equal(await response.text(), 'indisponível');
});

test('redirect define destino e preserva cookie quando fornecido', () => {
  const response = redirect('/painel', 'fluxo_session=abc; HttpOnly; Secure');
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/painel');
  assert.match(response.headers.get('set-cookie') || '', /HttpOnly/);
});

test('headers de segurança incluem no-sniff e política de frame', () => {
  const headers = cabecalhosSegurancaV30();
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.equal(headers['x-robots-tag'], 'noindex, nofollow, noarchive');
});


test('ficha de produção usa o renderizador atual de etapas e mantém ações especiais', async () => {
  const source = await readFile(new URL('../worker/legacy.js', import.meta.url), 'utf8');
  const inicio = source.indexOf('function cardEtapaFichaV3417(');
  const fim = source.indexOf('function blocoArcada(', inicio);
  assert.ok(inicio >= 0 && fim > inicio, 'função de renderização da ficha deve existir');
  const helper = source.slice(inicio, fim);
  assert.ok(helper.includes('cardProducaoV336(usuario, etapa, "etapas")'));
  assert.ok(helper.includes('formularioResponsavelProjetoConcluidoV3417('));
  assert.ok(helper.includes('formularioDesfazerConclusaoAcabamentoV351('));
});

test('pacotes excluídos não aparecem nas listagens digitais', async () => {
  const source = await readFile(new URL('../worker/legacy.js', import.meta.url), 'utf8');
  const inicioTrabalho = source.indexOf('async function listarPacotesTrabalhoV321(');
  const inicioVisiveis = source.indexOf('async function listarPacotesVisiveisV321(');
  const fimVisiveis = source.indexOf('async function registrarEventoPacoteV321(', inicioVisiveis);
  assert.ok(inicioTrabalho >= 0 && inicioVisiveis > inicioTrabalho && fimVisiveis > inicioVisiveis);
  const porTrabalho = source.slice(inicioTrabalho, inicioVisiveis);
  const visiveis = source.slice(inicioVisiveis, fimVisiveis);
  assert.ok(porTrabalho.includes("AND p.status!='EXCLUIDO'"));
  assert.ok(visiveis.includes("WHERE p.status!='EXCLUIDO'"));
});


test('ficha de produção encaminha componentes ao renderizador atual', async () => {
  const source = await readFile(new URL('../worker/legacy.js', import.meta.url), 'utf8');
  const inicio = source.indexOf('function cardProducaoV336(');
  const fim = source.indexOf('function cardEtapaFichaV3417(', inicio);
  assert.ok(inicio >= 0 && fim > inicio, 'despachante de cartões de produção deve existir');
  const bloco = source.slice(inicio, fim);
  assert.ok(bloco.includes('cardEtapaBaseV336(u, r)'));
  assert.ok(bloco.includes('cardComponenteBaseV336(u, r)'));
  assert.ok(bloco.includes('htmlRetrabalhoV336(u, r)'));
});

test('rota GET direta do trabalho carrega paciente, etapas e componentes com permissão', async () => {
  const source = await readFile(new URL('../worker/legacy.js', import.meta.url), 'utf8');
  const autorizacao = source.indexOf('usuarioPodeVerTrabalhoDigitalV345(env, usuario, id)');
  assert.ok(autorizacao >= 0, 'verificação de acesso ao trabalho deve existir');
  const inicio = source.lastIndexOf('match = caminho.match(', autorizacao);
  const fim = source.indexOf('match = caminho.match(', autorizacao + 1);
  assert.ok(inicio >= 0 && fim > inicio, 'rota GET direta de trabalho deve estar delimitada');
  const rota = source.slice(inicio, fim);
  assert.ok(rota.includes('request.method === "GET"'));
  assert.ok(rota.includes('await obterTrabalho('));
  assert.ok(rota.includes('usuarioPodeVerTrabalhoDigitalV345(env, usuario, id)'));
  assert.ok(rota.includes('paginaFicha('));
  assert.ok(rota.includes('await listarEtapas('));
  assert.ok(rota.includes('await listarComponentes('));
  assert.ok(rota.includes('await listarRetrabalhos('));
});


import { escaparHtmlAlmox, sinalMovimentoAlmox, handleAlmoxarifado, setoresDisponiveisAlmox } from "../worker/modules/almoxarifado.js";

test("Almoxarifado escapa texto antes de inserir dados no HTML", () => {
  assert.equal(escaparHtmlAlmox("<script>&\"'"), "&lt;script&gt;&amp;&quot;&#39;");
});

test("sinais dos movimentos produzem saldo apenas por lançamentos", () => {
  assert.equal(sinalMovimentoAlmox("ENTRADA"), 1);
  assert.equal(sinalMovimentoAlmox("AJUSTE_POSITIVO"), 1);
  assert.equal(sinalMovimentoAlmox("SAIDA"), -1);
  assert.equal(sinalMovimentoAlmox("PERDA"), -1);
  assert.equal(sinalMovimentoAlmox("VENCIMENTO"), -1);
  assert.equal(sinalMovimentoAlmox("TRANSFERENCIA"), 0);
});

test("rota do Almoxarifado exige sessão autenticada", async () => {
  const env = { db: { prepare() { return { bind() { return this; }, first: async () => null }; } } };
  const response = await handleAlmoxarifado(
    new Request("https://app.markfree.com.br/almoxarifado"),
    env,
    new URL("https://app.markfree.com.br/almoxarifado")
  );
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/");
});

test("migração protege saldo, validade e imutabilidade diretamente no D1", async () => {
  const sql = await readFile(new URL("../worker/migrations/0002_v5100_almoxarifado.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE VIEW almoxarifado_saldos_lotes/);
  assert.match(sql, /Saldo insuficiente no lote/);
  assert.match(sql, /Lote vencido, em quarentena ou bloqueado não pode sair/);
  assert.match(sql, /trg_almox_movimentos_nao_atualizar/);
  assert.match(sql, /trg_almox_movimentos_nao_apagar/);
  assert.match(sql, /trg_almox_limite_atendimento/);
  assert.ok(!sql.includes("saldo REAL"));
});

test("ponto de entrada encaminha somente o Almoxarifado e preserva o Worker legado", async () => {
  const source = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");
  assert.ok(source.includes('import legado from "./legacy.js"'));
  assert.match(source, /return handleAlmoxarifado/);
  assert.ok(source.includes("legado.fetch(request, env, ctx)"));
  assert.match(source, /injetarLinkAlmoxarifado/);
});

test("requisições respeitam os setores vinculados ao usuário", () => {
  assert.deepEqual(
    setoresDisponiveisAlmox({ perfil: "FUNCIONARIO", setores_v31: "DIGITAL:CAD/CAM|DIGITAL:IMPRESSAO" }),
    ["DIGITAL:CAD/CAM", "DIGITAL:IMPRESSAO"]
  );
  assert.deepEqual(
    setoresDisponiveisAlmox({ perfil: "FUNCIONARIO", setor_convencional: "ACRILIZACAO" }),
    ["CONVENCIONAL:ACRILIZACAO"]
  );
  assert.ok(setoresDisponiveisAlmox({ perfil: "ADMINISTRADOR" }).includes("CONVENCIONAL:QUALIDADE"));
});
