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


import { escaparHtmlAlmox, sinalMovimentoAlmox, handleAlmoxarifado, integrarTelaAlmoxarifado, renderEspacoColaboradorAlmoxarife, setoresDisponiveisAlmox, podeGerenciarAlmox, ehFuncionarioAlmoxarifado, deveBloquearRotaAlmoxarife, atualizarIdentificacaoVersaoAlmoxarifado, injetarLinkAlmoxarifado } from "../worker/modules/almoxarifado.js";

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
  assert.match(source, /const respostaAlmox = await handleAlmoxarifado/);
  assert.ok(source.includes("legado.fetch(request, env, ctx)"));
  assert.match(source, /integrarTelaAlmoxarifado/);
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

test("funcionário Almoxarife entra no painel exclusivo e não acessa páginas gerais", () => {
  assert.equal(deveBloquearRotaAlmoxarife(true, "/", "GET"), true);
  assert.equal(deveBloquearRotaAlmoxarife(true, "/funcionarios", "GET"), true);
  assert.equal(deveBloquearRotaAlmoxarife(true, "/api/trabalhos", "GET"), true);
  assert.equal(deveBloquearRotaAlmoxarife(true, "/almoxarifado", "GET"), false);
  assert.equal(deveBloquearRotaAlmoxarife(true, "/almoxarifado/api/itens", "GET"), false);
  assert.equal(deveBloquearRotaAlmoxarife(true, "/logout", "POST"), false);
  assert.equal(deveBloquearRotaAlmoxarife(true, "/service-worker.js", "GET"), false);
  assert.equal(deveBloquearRotaAlmoxarife(true, "/manifest.webmanifest", "GET"), false);
  assert.equal(deveBloquearRotaAlmoxarife(true, "/meu-espaco", "GET"), false);
  assert.equal(deveBloquearRotaAlmoxarife(true, "/comunicacao", "GET"), false);
  assert.equal(deveBloquearRotaAlmoxarife(true, "/agenda-tarefas", "GET"), false);
  assert.equal(deveBloquearRotaAlmoxarife(true, "/digital", "GET"), true);
  assert.equal(deveBloquearRotaAlmoxarife(true, "/digital/chat-equipe", "GET"), true);
  assert.equal(deveBloquearRotaAlmoxarife(true, "/minha-producao", "GET"), true);
  assert.equal(deveBloquearRotaAlmoxarife(false, "/funcionarios", "GET"), false);
});

test("o Almoxarifado mantém navegação interna por permissões e o Sair no shell padrão", async () => {
  const source = await readFile(new URL("../worker/modules/almoxarifado.js", import.meta.url), "utf8");
  const inicio = source.indexOf("function layoutAlmox(");
  const fim = source.indexOf("async function renderView(", inicio);
  assert.ok(inicio >= 0 && fim > inicio);
  const layout = source.slice(inicio, fim);
  assert.match(layout, /Consultar materiais/);
  assert.match(layout, /Requisições/);
  assert.match(layout, /Área exclusiva · Almoxarifado/);
  assert.match(layout, /action="\/logout"/);
});

test("o vínculo ativo de funcionário do Almoxarifado é identificado separadamente", async () => {
  const user = { id: 9, perfil: "FUNCIONARIO" };
  const env = { db: { prepare(sql) { return { bind(id) { return { first: async () => sql.includes("almoxarifado_equipe") && id === 9 ? { 1: 1 } : null }; } }; } } };
  assert.equal(await ehFuncionarioAlmoxarifado(env, user), true);
  assert.equal(await ehFuncionarioAlmoxarifado(env, { id: 10, perfil: "FUNCIONARIO" }), false);
  assert.equal(await ehFuncionarioAlmoxarifado(env, { id: 9, perfil: "ADMINISTRADOR" }), false);
});

test("somente o vínculo ativo de almoxarife concede gestão do estoque", async () => {
  const admin = { id: 1, perfil: "ADMINISTRADOR" };
  const coord = { id: 2, perfil: "COORDENADOR" };
  const ordinary = { id: 3, perfil: "FUNCIONARIO" };
  const assigned = { id: 4, perfil: "FUNCIONARIO" };
  const env = { db: { prepare(sql) { return { bind(id) { return { first: async () => sql.includes("almoxarifado_equipe") && id === 4 ? { 1: 1 } : null }; } }; } } };
  assert.equal(await podeGerenciarAlmox(env, admin), true);
  assert.equal(await podeGerenciarAlmox(env, coord), true);
  assert.equal(await podeGerenciarAlmox(env, ordinary), false);
  assert.equal(await podeGerenciarAlmox(env, assigned), true);
});

test("conta de almoxarife usa área independente e não ganha acesso de produção", async () => {
  const source = await readFile(new URL("../worker/modules/almoxarifado.js", import.meta.url), "utf8");
  assert.match(source, /'ALMOXARIFADO','ALMOXARIFADO',NULL,'FUNCIONARIO',1,0/);
  assert.match(source, /id="painel-equipe-almox"/);
  assert.match(source, /processarEquipeAlmoxarifado/);
});

test("interface identifica a versão 5.12.0 nas páginas HTML", () => {
  const html = '<title>Fluxo Lab V5.9.0</title><span>V5.10.0 · V5.11.0</span>';
  assert.equal(
    atualizarIdentificacaoVersaoAlmoxarifado(html, "/funcionarios"),
    '<title>Fluxo Lab V5.12.0</title><span>V5.12.0 · V5.12.0</span>'
  );
});

test("service worker recebe uma chave de cache nova na V5.12.0", () => {
  const source = "const FLUXO_CACHE='fluxo-lab-v5.9.0';const OLD='fluxo-lab-v5.10.0';const PREV='fluxo-lab-v5.11.0';";
  assert.equal(
    atualizarIdentificacaoVersaoAlmoxarifado(source, "/service-worker.js"),
    "const FLUXO_CACHE='fluxo-lab-v5.12.0';const OLD='fluxo-lab-v5.12.0';const PREV='fluxo-lab-v5.12.0';"
  );
});

test("injeta menu e versão atualizada no HTML servido pelo Worker legado", async () => {
  const body = '<html><body><span>Fluxo Lab V5.9.0</span><nav class="sidebar-nav"><details class="nav-bloco-v325"><div class="nav-bloco-itens-v325"><a href="/">Início</a></div></details><details class="nav-bloco-v325"><div class="nav-bloco-itens-v325"><a href="/meu-espaco">Meu Espaço</a></div></details></nav></body></html>';
  const response = await injetarLinkAlmoxarifado(
    new Response(body, {status:200,headers:{"content-type":"text/html; charset=utf-8","content-length":String(body.length)}}),
    new Request("https://app.markfree.com.br/funcionarios")
  );
  const html = await response.text();
  assert.match(html, /V5.12.0/);
  assert.match(html, /href="\/almoxarifado"/);
  assert.equal(response.headers.get("content-length"), null);
});



test("Espaço do Colaborador do Almoxarife preserva ferramentas pessoais sem mostrar produção", () => {
  const html = renderEspacoColaboradorAlmoxarife({nome:"Yan"});
  assert.match(html, /Chat da equipe/);
  assert.match(html, /Comunicação e solicitações/);
  assert.match(html, /Agenda e tarefas/);
  assert.match(html, /Minhas anotações/);
  assert.match(html, /Meu perfil/);
  assert.match(html, /Universidade Fluxo Lab/);
  assert.match(html, /Minha coleção de emblemas/);
  assert.doesNotMatch(html, /Minha produção|Minha evolução|Liderança da produção|\/minha-producao|\/minha-evolucao|\/lideranca-producao/);
});

test("o Worker substitui o Meu Espaço produtivo pelo central do Almoxarife", async () => {
  const source = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");
  assert.match(source, /adaptarMeuEspacoAlmoxarife\(response, request, env\)/);
});

test("página do Almoxarifado usa o layout e o menu lateral nativos do Fluxo Lab", async () => {
  const almox = new Response('<html><body><main class="wrap"><div class="intro"><h1>Consultar materiais</h1></div><nav aria-label="Navegação do almoxarifado"><a href="/almoxarifado?view=itens">Consultar materiais</a></nav><section class="panel">Catálogo</section></main></body></html>', {
    status:200,headers:{"content-type":"text/html; charset=utf-8"}
  });
  const shell = new Response('<html><head><title>Meu perfil · Fluxo Lab</title></head><body><aside class="sidebar"><nav class="sidebar-nav"><a href="/almoxarifado">Almoxarifado</a></nav></aside><header><div class="topbar-titulo"><strong>Meu perfil</strong></div></header><main class="container"><section>Conteúdo substituído</section></main></body></html>', {
    status:200,headers:{"content-type":"text/html; charset=utf-8"}
  });
  const response = await integrarTelaAlmoxarifado(almox,shell);
  const html = await response.text();
  assert.match(html, /sidebar/);
  assert.match(html, /topbar-titulo/);
  assert.match(html, /Almoxarifado · Fluxo Lab/);
  assert.ok(html.includes("<strong>Almoxarifado</strong>"));
  assert.match(html, /estilo-almoxarifado-integrado/);
  assert.match(html, /almox-integrado/);
  assert.doesNotMatch(html, /<main class="wrap">/);
});

test("funcionário comum não recebe acesso à gestão de lotes ou movimentos", async () => {
  const source = await readFile(new URL("../worker/modules/almoxarifado.js", import.meta.url), "utf8");
  assert.match(source, /if \(!gerente\) return respostaJson\(\{erro:"Consulta de lotes restrita/);
  assert.match(source, /if \(!gerente\) return respostaJson\(\{erro:"Histórico restrito/);
  assert.match(source, /dadosRequisicoes\(env,gerente \? null : user\)/);
});

test("o menu Almoxarifado separa a área operacional do espaço do colaborador", async () => {
  const source = await readFile(new URL("../worker/modules/almoxarifado.js", import.meta.url), "utf8");
  assert.match(source, /if \(almoxarife\) \{/);
  assert.match(source, /Meu Espaço/);
  assert.match(source, /Chat da equipe/);
  assert.match(source, /Comunicação e solicitações/);
  assert.match(source, /if \(bloco === 1\) return open \+ link \+ close/);
  assert.match(source, /if \(bloco === 2\)/);\n  assert.match(source, /nav-bloco-v325.*open/);
});

test("o Almoxarifado possui chat próprio e não usa o chat da produção Digital", async () => {
  const source = await readFile(new URL("../worker/modules/almoxarifado.js", import.meta.url), "utf8");
  assert.match(source, /almoxarifado_chat_mensagens/);
  assert.match(source, /url\.pathname === "\/almoxarifado\/chat"/);
  assert.match(source, /Acesso restrito à equipe do Almoxarifado/);
  assert.match(source, /href="\/almoxarifado\/chat"/);
});

test("a atualização conserva apenas um ponto de entrada e integra o shell oficial", async () => {
  const source = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");
  assert.match(source, /integrarTelaAlmoxarifado/);
  assert.match(source, /new URL\("\/meu-perfil", request.url\)/);
  assert.match(source, /injetarLinkAlmoxarifado\(response, request, env\)/);
});

test("injeta cache novo no service worker sem alterar outros scripts", async () => {
  const body = "const FLUXO_CACHE='fluxo-lab-v5.9.0';";
  const response = await injetarLinkAlmoxarifado(
    new Response(body, {status:200,headers:{"content-type":"application/javascript; charset=utf-8"}}),
    new Request("https://app.markfree.com.br/service-worker.js")
  );
  assert.equal(await response.text(), "const FLUXO_CACHE='fluxo-lab-v5.12.0';");
});

