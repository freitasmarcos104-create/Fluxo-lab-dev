import test from "node:test";
import assert from "node:assert/strict";
import {
  selecaoProtesesRemessaV515,
  rotuloSelecaoProtesesRemessaV515,
  classificacaoProtesesRemessaV515,
  renderBadgesProtesesRemessaV515,
  renderPainelProtesesRemessaV515
} from "../worker/modules/remessas-proteses.js";

test("rotulos individuais e combinado independem da arcada", () => {
  assert.equal(rotuloSelecaoProtesesRemessaV515({ superior_tipo: "PT", inferior_tipo: "NONE" }), "PT");
  assert.equal(rotuloSelecaoProtesesRemessaV515({ superior_tipo: "NONE", inferior_tipo: "PPR" }), "PPR");
  assert.equal(rotuloSelecaoProtesesRemessaV515({ superior_tipo: "PT", inferior_tipo: "PPR" }), "PPR + PT");
  assert.equal(rotuloSelecaoProtesesRemessaV515({ superior_tipo: "PPR", inferior_tipo: "PT" }), "PPR + PT");
});

test("tipo TOTAL e duplicados viram um unico badge PT", () => {
  assert.deepEqual(selecaoProtesesRemessaV515({ superior_tipo: "TOTAL", inferior_tipo: "PT" }), ["PT"]);
  assert.equal(classificacaoProtesesRemessaV515({ superior_tipo: "PT", inferior_tipo: "PT" }).pt, true);
});

test("sem trabalho nao entra nas contagens e novos tipos sao dinamicos", () => {
  assert.equal(rotuloSelecaoProtesesRemessaV515({ superior_tipo: "NONE", inferior_tipo: null }), "Sem prótese");
  assert.equal(rotuloSelecaoProtesesRemessaV515({ superior_tipo: "PPR", inferior_tipo: "PLACA" }), "PPR + PLACA");
  assert.equal(classificacaoProtesesRemessaV515({ superior_tipo: "PPR", inferior_tipo: "PT" }).combinado, true);
  assert.equal(classificacaoProtesesRemessaV515({ superior_tipo: "PPR", inferior_tipo: "PLACA" }).ppr, false);
});

test("contadores de todos, tipos exclusivos e combinados na remessa", () => {
  const pacientes = [
    { id: 1, paciente: "A", codigo: "A-1", superior_tipo: "PT", inferior_tipo: "NONE" },
    { id: 2, paciente: "B", codigo: "B-1", superior_tipo: "PPR", inferior_tipo: "NONE" },
    { id: 3, paciente: "C", codigo: "C-1", superior_tipo: "PT", inferior_tipo: "PPR" },
    { id: 4, paciente: "D", codigo: "D-1", superior_tipo: "PT", inferior_tipo: "PT" }
  ];
  const html = renderPainelProtesesRemessaV515(pacientes, 30);
  assert.match(html, /data-filtro-v515="todos"[^>]*>Todos <strong>4<\/strong>/);
  assert.match(html, /data-filtro-v515="pt"[^>]*>PT <strong>2<\/strong>/);
  assert.match(html, /data-filtro-v515="ppr"[^>]*>PPR <strong>1<\/strong>/);
  assert.match(html, /data-filtro-v515="combinado"[^>]*>PPR \+ PT <strong>1<\/strong>/);
  assert.match(html, /Agrupado por seleção/);
  assert.match(html, /data-grupo-v515/);
});

test("nomes e tipos vindos do banco recebem escape de HTML", () => {
  const paciente = { id: 9, paciente: "<img src=x onerror=alert(1)>", codigo: "x&y", superior_tipo: "PT", inferior_tipo: "NONE" };
  const html = renderPainelProtesesRemessaV515([paciente], 30);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
  assert.match(html, /x&amp;y/);
  assert.match(renderBadgesProtesesRemessaV515(paciente), /badge ok/);
});
