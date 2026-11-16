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
  const fim = source.indexOf('\\nfunction blocoArcada(', inicio);
  assert.ok(inicio >= 0 && fim > inicio, 'função de renderização da ficha deve existir');
  const helper = source.slice(inicio, fim);
  assert.match(helper, /const html = cardEtapaBaseV336\\(usuario, etapa\\);/);
  assert.doesNotMatch(helper, /cardEtapa\\(usuario, etapa\\)/);
});

test('pacotes excluídos não aparecem nas listagens digitais', async () => {
  const source = await readFile(new URL('../worker/legacy.js', import.meta.url), 'utf8');
  assert.match(source, /WHERE p\\.trabalho_id=\\?\\s+AND p\\.status!='EXCLUIDO'/);
  assert.match(source, /WHERE p\\.status!='EXCLUIDO'\\s+AND\\s+\\(/);
});
