import test from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENT_CATALOG_VERSION,
  RARITIES,
  TIPOS_RECONHECIMENTO,
  EMBLEMAS_PRODUCAO_EXPANSAO,
  EMBLEMAS_SEQUENCIA_EXPANSAO,
  EMBLEMAS_TAREFAS_EXPANSAO,
  EMBLEMAS_ORGANIZACAO_LIMPEZA,
  avaliarEmblemasAdmin,
  isIsoDate,
  validarReconhecimento
} from "../worker/modules/achievements.js";

// Códigos já existentes em produção (legacy.js, V5.8.8). Os novos não podem colidir com eles,
// porque emblemas_conquistas_v325 tem UNIQUE (usuario_id, codigo).
const CODIGOS_EXISTENTES = [
  "PRODUCAO_25", "PRODUCAO_50", "PRODUCAO_100", "PRODUCAO_250", "PRODUCAO_500",
  "META_1_SEMANA", "META_3_SEMANAS", "META_5_SEMANAS",
  "AGENDA_MISSAO_CUMPRIDA", "AGENDA_PONTUALIDADE_20"
];

const TODOS = [
  ...EMBLEMAS_PRODUCAO_EXPANSAO,
  ...EMBLEMAS_SEQUENCIA_EXPANSAO,
  ...EMBLEMAS_TAREFAS_EXPANSAO,
  ...EMBLEMAS_ORGANIZACAO_LIMPEZA
];

const reg = (tipo, data, revogado_em = null) => ({ tipo, data_referencia: data, revogado_em });
const porCodigo = (lista, codigo) => lista.find((x) => x.codigo === codigo);

test("catálogo 2.0.0 tem 3 + 2 + 3 automáticos e 7 de organização e limpeza", () => {
  assert.equal(ACHIEVEMENT_CATALOG_VERSION, "2.0.0");
  assert.equal(EMBLEMAS_PRODUCAO_EXPANSAO.length, 3);
  assert.equal(EMBLEMAS_SEQUENCIA_EXPANSAO.length, 2);
  assert.equal(EMBLEMAS_TAREFAS_EXPANSAO.length, 3);
  assert.equal(EMBLEMAS_ORGANIZACAO_LIMPEZA.length, 7);
});

test("códigos são únicos e não colidem com os existentes em produção", () => {
  const codigos = TODOS.map((x) => x.codigo);
  assert.equal(new Set(codigos).size, codigos.length);
  for (const codigo of codigos) assert.ok(!CODIGOS_EXISTENTES.includes(codigo), `colisão: ${codigo}`);
});

test("todo emblema tem título, descrição, ícone, meta positiva e raridade conhecida", () => {
  for (const e of TODOS) {
    assert.ok(e.titulo && e.descricao && e.icone, e.codigo);
    assert.ok(Number.isInteger(e.meta) && e.meta > 0, e.codigo);
  }
  for (const e of [...EMBLEMAS_TAREFAS_EXPANSAO, ...EMBLEMAS_ORGANIZACAO_LIMPEZA]) {
    assert.ok(RARITIES[e.raridade.toLowerCase()], `raridade desconhecida em ${e.codigo}`);
  }
});

test("expansão automática usa só métricas que já existem em produção", () => {
  for (const e of EMBLEMAS_TAREFAS_EXPANSAO) assert.ok(["CONCLUIDAS", "PONTUAIS"].includes(e.metrica));
  for (const e of EMBLEMAS_PRODUCAO_EXPANSAO) assert.equal(e.categoria, "PRODUCAO");
  for (const e of EMBLEMAS_SEQUENCIA_EXPANSAO) assert.equal(e.categoria, "CONSISTENCIA");
});

test("cada emblema de organização aponta para um tipo de reconhecimento válido", () => {
  for (const e of EMBLEMAS_ORGANIZACAO_LIMPEZA) {
    assert.equal(e.categoria, "ORGANIZACAO_LIMPEZA");
    assert.ok(Object.hasOwn(TIPOS_RECONHECIMENTO, e.tipoReconhecimento), e.codigo);
  }
});

test("sem reconhecimentos nenhum emblema administrativo é liberado", () => {
  const r = avaliarEmblemasAdmin([]);
  assert.equal(r.length, 7);
  assert.ok(r.every((x) => x.atual === 0 && x.percentual === 0 && x.conquistado === false));
  assert.equal(avaliarEmblemasAdmin(undefined).length, 7);
  assert.equal(avaliarEmblemasAdmin("lixo").length, 7);
});

test("abertura de bancada: dias distintos; mesmo dia repetido conta uma vez", () => {
  const quatro = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-05"].map((d) => reg("ABERTURA_BANCADA", d));
  let e = porCodigo(avaliarEmblemasAdmin(quatro), "ORG_BANCADA_PREPARADA");
  assert.equal(e.atual, 4);
  assert.equal(e.percentual, 80);
  assert.equal(e.conquistado, false);
  e = porCodigo(avaliarEmblemasAdmin([...quatro, reg("ABERTURA_BANCADA", "2026-11-06")]), "ORG_BANCADA_PREPARADA");
  assert.equal(e.atual, 5);
  assert.equal(e.conquistado, true);
});

test("reconhecimento revogado ou com data inválida não conta", () => {
  const lista = [
    ...Array.from({ length: 9 }, (_, i) => reg("AUDITORIA_FERRAMENTAL", `2026-10-${String(i + 1).padStart(2, "0")}`)),
    reg("AUDITORIA_FERRAMENTAL", "2026-10-20", "2026-10-21T10:00:00Z"),
    reg("AUDITORIA_FERRAMENTAL", "2026-02-30"),
    null
  ];
  const e = porCodigo(avaliarEmblemasAdmin(lista), "ORG_FERRAMENTAL_ORGANIZADO");
  assert.equal(e.atual, 9);
  assert.equal(e.conquistado, false);
});

test("tipos diferentes não se misturam", () => {
  const lista = Array.from({ length: 10 }, (_, i) => reg("AUDITORIA_ESTOQUE", `2026-09-${String(i + 1).padStart(2, "0")}`));
  const r = avaliarEmblemasAdmin(lista);
  assert.equal(porCodigo(r, "ORG_ESTOQUE_IDENTIFICADO").conquistado, true);
  assert.equal(porCodigo(r, "ORG_FERRAMENTAL_ORGANIZADO").atual, 0);
  assert.equal(porCodigo(r, "ORG_DESCARTE_RESPONSAVEL").atual, 0);
});

test("Sala 5S conta semanas distintas (segunda a domingo)", () => {
  // 2026-11-02 é segunda; 2026-11-08 é domingo da mesma semana.
  const mesmaSemana = [reg("SEMANA_5S", "2026-11-02"), reg("SEMANA_5S", "2026-11-08")];
  assert.equal(porCodigo(avaliarEmblemasAdmin(mesmaSemana), "ORG_SALA_5S").atual, 1);
  const quatroSemanas = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"].map((d) => reg("SEMANA_5S", d));
  const e = porCodigo(avaliarEmblemasAdmin(quatroSemanas), "ORG_SALA_5S");
  assert.equal(e.atual, 4);
  assert.equal(e.conquistado, true);
});

test("Guardião do Ambiente exige meses consecutivos, inclusive na virada do ano", () => {
  const seis = ["2026-08-10", "2026-09-10", "2026-10-10", "2026-11-10", "2026-12-10", "2027-01-10"].map((d) => reg("AUDITORIA_MENSAL", d));
  let e = porCodigo(avaliarEmblemasAdmin(seis), "ORG_GUARDIAO_AMBIENTE");
  assert.equal(e.atual, 6);
  assert.equal(e.conquistado, true);

  const comBuraco = ["2026-01-10", "2026-02-10", "2026-03-10", "2026-05-10", "2026-06-10"].map((d) => reg("AUDITORIA_MENSAL", d));
  e = porCodigo(avaliarEmblemasAdmin(comBuraco), "ORG_GUARDIAO_AMBIENTE");
  assert.equal(e.atual, 3);
  assert.equal(e.conquistado, false);

  const doisNoMesmoMes = [reg("AUDITORIA_MENSAL", "2026-03-02"), reg("AUDITORIA_MENSAL", "2026-03-20")];
  assert.equal(porCodigo(avaliarEmblemasAdmin(doisNoMesmoMes), "ORG_GUARDIAO_AMBIENTE").atual, 1);
});

test("percentual nunca passa de 100 e atual nunca passa da meta", () => {
  const lista = Array.from({ length: 30 }, (_, i) => reg("DESCARTE_CORRETO", `2026-06-${String(i + 1).padStart(2, "0")}`));
  const e = porCodigo(avaliarEmblemasAdmin(lista), "ORG_DESCARTE_RESPONSAVEL");
  assert.equal(e.atual, 10);
  assert.equal(e.percentual, 100);
  assert.equal(e.conquistado, true);
});

test("isIsoDate aceita só datas reais no formato AAAA-MM-DD", () => {
  assert.equal(isIsoDate("2026-11-15"), true);
  assert.equal(isIsoDate("2028-02-29"), true);
  assert.equal(isIsoDate("2027-02-29"), false);
  assert.equal(isIsoDate("2026-13-01"), false);
  assert.equal(isIsoDate("15/11/2026"), false);
  assert.equal(isIsoDate("2026-11-15T10:00:00Z"), false);
  assert.equal(isIsoDate(20261115), false);
  assert.equal(isIsoDate(null), false);
});

test("validarReconhecimento aceita um pedido correto", () => {
  const r = validarReconhecimento({ usuarioId: 7, concedidoPor: 1, tipo: "SEMANA_5S", dataReferencia: "2026-11-10", hoje: "2026-11-15" });
  assert.deepEqual(r, { ok: true });
  assert.equal(validarReconhecimento({ usuarioId: "7", concedidoPor: "1", tipo: "SEMANA_5S", dataReferencia: "2026-11-15", hoje: "2026-11-15" }).ok, true);
});

test("validarReconhecimento rejeita auto-concessão, data futura, tipo e ids inválidos", () => {
  const base = { usuarioId: 7, concedidoPor: 1, tipo: "SEMANA_5S", dataReferencia: "2026-11-10", hoje: "2026-11-15" };
  assert.equal(validarReconhecimento({ ...base, usuarioId: 1 }).ok, false);
  assert.match(validarReconhecimento({ ...base, usuarioId: 1 }).erro, /si mesmo/);
  assert.equal(validarReconhecimento({ ...base, dataReferencia: "2026-11-16" }).ok, false);
  assert.equal(validarReconhecimento({ ...base, tipo: "PRODUCAO_999" }).ok, false);
  assert.equal(validarReconhecimento({ ...base, tipo: "toString" }).ok, false);
  assert.equal(validarReconhecimento({ ...base, usuarioId: 0 }).ok, false);
  assert.equal(validarReconhecimento({ ...base, usuarioId: null }).ok, false);
  assert.equal(validarReconhecimento({ ...base, concedidoPor: -2 }).ok, false);
  assert.equal(validarReconhecimento({ ...base, dataReferencia: "2026-02-30" }).ok, false);
  assert.equal(validarReconhecimento({ ...base, hoje: "amanhã" }).ok, false);
  assert.equal(validarReconhecimento().ok, false);
});
