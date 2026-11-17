import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RICH_NOTE_PREFIX_V590,
  sanitizeRichNoteHtml,
  serializeRichNoteValue,
  renderRichNoteValue,
  countRichNoteCharacters
} from '../worker/modules/rich-notes.js';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

test('negrito e marca-texto usam somente tags e cores autorizadas', () => {
  const result = sanitizeRichNoteHtml(
    '<b>URGENTE</b> <mark data-cor="red" style="color: black" onclick="alert(1)">PPR</mark>'
  );
  assert.equal(
    result.html,
    '<strong>URGENTE</strong> <mark data-cor="red">PPR</mark>'
  );
  assert.equal(result.text, 'URGENTE PPR');
  assert.equal(result.length, 11);
});

test('remove scripts e atributos sem descartar o texto comum', () => {
  const result = sanitizeRichNoteHtml(
    '<strong>Paciente</strong><script>alert("x")</script><img src=x onerror=alert(1)> confirmado'
  );
  assert.equal(result.html, '<strong>Paciente</strong> confirmado');
  assert.doesNotMatch(result.html, /script|onerror|<img/i);
});

test('cores desconhecidas caem no amarelo padrão', () => {
  const result = sanitizeRichNoteHtml('<mark data-cor="purple">Atenção</mark>');
  assert.equal(result.html, '<mark data-cor="yellow">Atenção</mark>');
});

test('notas antigas em texto puro continuam legíveis e escapadas', () => {
  assert.equal(
    renderRichNoteValue('linha 1\n<script>alert(1)</script>', escapeHtml),
    'linha 1<br>&lt;script&gt;alert(1)&lt;/script&gt;'
  );
  assert.equal(countRichNoteCharacters('texto antigo'), 12);
});

test('notas formatadas são identificadas e reabertas sem perder formatação', () => {
  const saved = serializeRichNoteValue('<strong>210 peças</strong><br><mark data-cor="green">Concluído</mark>');
  assert.equal(saved.tooLong, false);
  assert.ok(saved.value.startsWith(RICH_NOTE_PREFIX_V590));
  assert.equal(countRichNoteCharacters(saved.value), 19);
  assert.equal(
    renderRichNoteValue(saved.value, escapeHtml),
    '<strong>210 peças</strong><br><mark data-cor="green">Concluído</mark>'
  );
});

test('limite de 4.000 caracteres considera texto visível, não as tags', () => {
  const dentro = serializeRichNoteValue('<strong>' + 'a'.repeat(4000) + '</strong>');
  const fora = serializeRichNoteValue('a'.repeat(4001));
  assert.equal(dentro.tooLong, false);
  assert.equal(dentro.length, 4000);
  assert.equal(fora.tooLong, true);
  assert.equal(fora.value, null);
});

test('caracteres HTML digitados permanecem texto, nunca viram tags', () => {
  const result = sanitizeRichNoteHtml('2 < 3 & 4 > 1');
  assert.equal(result.html, '2 &lt; 3 &amp; 4 > 1');
  assert.equal(result.text, '2 < 3 & 4 > 1');
});
