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


test('ficha de produção usa o renderizador de etapa existente', async () => {
  const source = await readFile(new URL('../worker/legacy.js', import.meta.url), 'utf8');
  const inicio = source.indexOf('function cardEtapaFichaV3417(');
  const fim = source.indexOf('function blocoArcada(', inicio);
  assert.ok(inicio >= 0 && fim > inicio, 'função de renderização da ficha deve existir');
  const helper = source.slice(inicio, fim);
  assert.ok(helper.includes('const html = cardEtapaBaseV336(usuario, etapa);'));
  assert.ok(!helper.includes('cardEtapa(usuario, etapa)'));
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


test('ficha do paciente renderiza componentes com a função existente', async () => {
  const source = await readFile(new URL('../worker/legacy.js', import.meta.url), 'utf8');
  const inicio = source.indexOf('function blocoArcada(');
  const fim = source.indexOf('function blocoRetrabalhosBaseV336(', inicio);
  assert.ok(inicio >= 0 && fim > inicio, 'bloco de arcada deve existir');
  const bloco = source.slice(inicio, fim);
  assert.ok(bloco.includes('cardComponenteBaseV336('));
  assert.ok(!bloco.includes('cardComponente('));
});

test('rota direta do trabalho consulta o paciente e monta a ficha completa', async () => {
  const source = await readFile(new URL('../worker/legacy.js', import.meta.url), 'utf8');
  const inicio = source.indexOf('/* ABRIR TRABALHO */');
  const fim = source.indexOf('/* CHAT */', inicio);
  assert.ok(inicio >= 0 && fim > inicio, 'rota GET de abertura do trabalho deve existir');
  const rota = source.slice(inicio, fim);
  assert.ok(rota.includes('caminho.match('));
  assert.ok(rota.includes('/^\\\\/trabalhos\\\\/(\\\\d+)$/'));
  assert.ok(rota.includes('await obterTrabalho('));
  assert.ok(rota.includes('usuarioPodeVerTrabalhoDigitalV345'));
  assert.ok(rota.includes('paginaFicha('));
  assert.ok(rota.includes('await listarEtapas('));
  assert.ok(rota.includes('await listarComponentes('));
});
