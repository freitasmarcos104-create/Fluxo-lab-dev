// Fluxo Lab — catálogo de emblemas V2.0.0
//
// Este módulo é puro: não acessa D1, rede nem relógio. Contém apenas emblemas que podem ser COMPROVADOS:
//   1) Expansão automática: usa dados que o sistema já registra (produção, semanas com meta, tarefas).
//   2) Organização e limpeza: concedidos por um administrador, com registro auditável (quem, quando, por quê).
// Os demais emblemas do catálogo 1.0.0 foram adiados (ver docs/achievements-expansion.md).

export const ACHIEVEMENT_CATALOG_VERSION = "2.0.0";

export const RARITIES = Object.freeze({
  comum: { label: "Comum", color: "#A0A5AD", order: 1 },
  bronze: { label: "Bronze", color: "#CD854C", order: 2 },
  prata: { label: "Prata", color: "#C5D0DC", order: 3 },
  ouro: { label: "Ouro", color: "#E9B943", order: 4 },
  platina: { label: "Platina", color: "#78BCEB", order: 5 },
  diamante: { label: "Diamante", color: "#25D8E8", order: 6 },
  lendario: { label: "Lendário", color: "#B68AFF", order: 7 },
  especial: { label: "Especial", color: "#F08BCE", order: 8 },
  secreto: { label: "Secreto", color: "#8B78E8", order: 9 }
});

// ---------------------------------------------------------------------------
// 1) Expansão automática — mesmo formato dos arrays existentes em legacy.js
//    (EMBLEMAS_PRODUCAO_V325, EMBLEMAS_SEQUENCIA_V325, EMBLEMAS_TAREFAS_V326).
//    Não exigem tabela nova: a gravação usa emblemas_conquistas_v325.
// ---------------------------------------------------------------------------

export const EMBLEMAS_PRODUCAO_EXPANSAO = Object.freeze([
  { codigo: "PRODUCAO_1000", categoria: "PRODUCAO", titulo: "Milhar de produção", descricao: "1.000 unidades de produção concluídas.", icone: "💠", meta: 1000 },
  { codigo: "PRODUCAO_1500", categoria: "PRODUCAO", titulo: "Mestre da produção", descricao: "1.500 unidades de produção concluídas.", icone: "🌟", meta: 1500 },
  { codigo: "PRODUCAO_2000", categoria: "PRODUCAO", titulo: "Titã da produção", descricao: "2.000 unidades de produção concluídas.", icone: "🔱", meta: 2000 }
]);

export const EMBLEMAS_SEQUENCIA_EXPANSAO = Object.freeze([
  { codigo: "META_8_SEMANAS", categoria: "CONSISTENCIA", titulo: "Disciplina de platina", descricao: "Oito semanas completas consecutivas com a meta atingida.", icone: "🌠", meta: 8 },
  { codigo: "META_12_SEMANAS", categoria: "CONSISTENCIA", titulo: "Trimestre perfeito", descricao: "Doze semanas completas consecutivas com a meta atingida.", icone: "🚀", meta: 12 }
]);

export const EMBLEMAS_TAREFAS_EXPANSAO = Object.freeze([
  {
    codigo: "AGENDA_CONCLUIDAS_25",
    categoria: "AGENDA",
    titulo: "Rotina em dia",
    descricao: "Conclua 25 tarefas atribuídas por um administrador. O prazo não interfere nesta conquista.",
    icone: "📋",
    meta: 25,
    metrica: "CONCLUIDAS",
    raridade: "PRATA",
    regra: "TAREFA_ADMIN_CONCLUIDA"
  },
  {
    codigo: "AGENDA_PONTUALIDADE_50",
    categoria: "AGENDA",
    titulo: "Pontualidade de Platina",
    descricao: "Conclua 50 tarefas atribuídas por um administrador até a data limite. Tarefas sem prazo não contam.",
    icone: "⏱️",
    meta: 50,
    metrica: "PONTUAIS",
    raridade: "PLATINA",
    regra: "TAREFA_ADMIN_CONCLUIDA_NO_PRAZO"
  },
  {
    codigo: "AGENDA_PONTUALIDADE_100",
    categoria: "AGENDA",
    titulo: "Pontualidade de Diamante",
    descricao: "Conclua 100 tarefas atribuídas por um administrador até a data limite. Tarefas sem prazo não contam.",
    icone: "🕰️",
    meta: 100,
    metrica: "PONTUAIS",
    raridade: "DIAMANTE",
    regra: "TAREFA_ADMIN_CONCLUIDA_NO_PRAZO"
  }
]);

// ---------------------------------------------------------------------------
// 2) Organização e limpeza — concedidos por administrador
// ---------------------------------------------------------------------------

export const TIPOS_RECONHECIMENTO = Object.freeze({
  ABERTURA_BANCADA: "Abertura de bancada aprovada",
  FECHAMENTO_BANCADA: "Fechamento de bancada aprovado",
  AUDITORIA_FERRAMENTAL: "Auditoria de ferramental aprovada",
  AUDITORIA_ESTOQUE: "Auditoria de estoque aprovada",
  DESCARTE_CORRETO: "Descarte correto registrado",
  SEMANA_5S: "Semana de 5S aprovada",
  AUDITORIA_MENSAL: "Auditoria mensal aprovada"
});

// contagem:
//   REGISTROS          cada reconhecimento válido conta 1
//   DIAS_DISTINTOS     vários reconhecimentos no mesmo dia contam 1
//   SEMANAS_DISTINTAS  várias no mesma semana (segunda a domingo) contam 1
//   MESES_CONSECUTIVOS maior sequência de meses seguidos com ao menos um reconhecimento
export const EMBLEMAS_ORGANIZACAO_LIMPEZA = Object.freeze([
  {
    codigo: "ORG_BANCADA_PREPARADA",
    categoria: "ORGANIZACAO_LIMPEZA",
    titulo: "Bancada Preparada",
    descricao: "Cinco aberturas de bancada aprovadas por um administrador.",
    icone: "🧰",
    meta: 5,
    raridade: "COMUM",
    tipoReconhecimento: "ABERTURA_BANCADA",
    contagem: "DIAS_DISTINTOS",
    regra: "RECONHECIMENTO_ADMIN"
  },
  {
    codigo: "ORG_FECHAMENTO_IMPECAVEL",
    categoria: "ORGANIZACAO_LIMPEZA",
    titulo: "Fechamento Impecável",
    descricao: "Cinco fechamentos de bancada aprovados por um administrador.",
    icone: "🧹",
    meta: 5,
    raridade: "BRONZE",
    tipoReconhecimento: "FECHAMENTO_BANCADA",
    contagem: "DIAS_DISTINTOS",
    regra: "RECONHECIMENTO_ADMIN"
  },
  {
    codigo: "ORG_FERRAMENTAL_ORGANIZADO",
    categoria: "ORGANIZACAO_LIMPEZA",
    titulo: "Ferramental Organizado",
    descricao: "Dez auditorias de ferramental aprovadas por um administrador.",
    icone: "🛠️",
    meta: 10,
    raridade: "PRATA",
    tipoReconhecimento: "AUDITORIA_FERRAMENTAL",
    contagem: "REGISTROS",
    regra: "RECONHECIMENTO_ADMIN"
  },
  {
    codigo: "ORG_ESTOQUE_IDENTIFICADO",
    categoria: "ORGANIZACAO_LIMPEZA",
    titulo: "Estoque Identificado",
    descricao: "Dez auditorias de estoque aprovadas por um administrador.",
    icone: "🏷️",
    meta: 10,
    raridade: "PRATA",
    tipoReconhecimento: "AUDITORIA_ESTOQUE",
    contagem: "REGISTROS",
    regra: "RECONHECIMENTO_ADMIN"
  },
  {
    codigo: "ORG_DESCARTE_RESPONSAVEL",
    categoria: "ORGANIZACAO_LIMPEZA",
    titulo: "Descarte Responsável",
    descricao: "Dez descartes corretos registrados por um administrador.",
    icone: "♻️",
    meta: 10,
    raridade: "OURO",
    tipoReconhecimento: "DESCARTE_CORRETO",
    contagem: "REGISTROS",
    regra: "RECONHECIMENTO_ADMIN"
  },
  {
    codigo: "ORG_SALA_5S",
    categoria: "ORGANIZACAO_LIMPEZA",
    titulo: "Sala 5S",
    descricao: "Quatro semanas de 5S aprovadas por um administrador.",
    icone: "✨",
    meta: 4,
    raridade: "PLATINA",
    tipoReconhecimento: "SEMANA_5S",
    contagem: "SEMANAS_DISTINTAS",
    regra: "RECONHECIMENTO_ADMIN"
  },
  {
    codigo: "ORG_GUARDIAO_AMBIENTE",
    categoria: "ORGANIZACAO_LIMPEZA",
    titulo: "Guardião do Ambiente",
    descricao: "Seis meses seguidos com auditoria mensal aprovada por um administrador.",
    icone: "🛡️",
    meta: 6,
    raridade: "LENDARIO",
    tipoReconhecimento: "AUDITORIA_MENSAL",
    contagem: "MESES_CONSECUTIVOS",
    regra: "RECONHECIMENTO_ADMIN"
  }
]);

// ---------------------------------------------------------------------------
// Datas (UTC, formato AAAA-MM-DD)
// ---------------------------------------------------------------------------

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value) {
  if (typeof value !== "string") return false;
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function inicioSemana(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const diaSemana = dt.getUTCDay() || 7; // domingo = 7; semana começa na segunda
  dt.setUTCDate(dt.getUTCDate() - diaSemana + 1);
  return dt.toISOString().slice(0, 10);
}

function indiceMes(iso) {
  const [y, m] = iso.split("-").map(Number);
  return y * 12 + (m - 1);
}

function contar(registros, contagem) {
  if (contagem === "REGISTROS") return registros.length;
  if (contagem === "DIAS_DISTINTOS") return new Set(registros.map((r) => r.data_referencia)).size;
  if (contagem === "SEMANAS_DISTINTAS") return new Set(registros.map((r) => inicioSemana(r.data_referencia))).size;
  if (contagem === "MESES_CONSECUTIVOS") {
    const meses = [...new Set(registros.map((r) => indiceMes(r.data_referencia)))].sort((a, b) => a - b);
    let melhor = 0;
    let atual = 0;
    let anterior = null;
    for (const mes of meses) {
      atual = anterior !== null && mes === anterior + 1 ? atual + 1 : 1;
      if (atual > melhor) melhor = atual;
      anterior = mes;
    }
    return melhor;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Avaliação e validação
// ---------------------------------------------------------------------------

// reconhecimentos: [{ tipo, data_referencia: "AAAA-MM-DD", revogado_em: null | string }]
// Reconhecimentos revogados ou com data inválida nunca contam.
export function avaliarEmblemasAdmin(reconhecimentos = []) {
  const validos = (Array.isArray(reconhecimentos) ? reconhecimentos : []).filter(
    (r) => r && !r.revogado_em && isIsoDate(r.data_referencia)
  );
  return EMBLEMAS_ORGANIZACAO_LIMPEZA.map((emblema) => {
    const doTipo = validos.filter((r) => r.tipo === emblema.tipoReconhecimento);
    const total = contar(doTipo, emblema.contagem);
    return Object.freeze({
      ...emblema,
      atual: Math.min(total, emblema.meta),
      percentual: Math.min(100, Math.floor((total / emblema.meta) * 100)),
      conquistado: total >= emblema.meta
    });
  });
}

// Regras que a rota do administrador deve aplicar antes de gravar um reconhecimento.
// `hoje` vem do chamador (data local AAAA-MM-DD), mantendo este módulo puro.
export function validarReconhecimento({ usuarioId, concedidoPor, tipo, dataReferencia, hoje } = {}) {
  const funcionario = Number(usuarioId);
  const administrador = Number(concedidoPor);
  if (!Number.isInteger(funcionario) || funcionario <= 0) return { ok: false, erro: "Funcionário inválido." };
  if (!Number.isInteger(administrador) || administrador <= 0) return { ok: false, erro: "Administrador inválido." };
  if (funcionario === administrador) {
    return { ok: false, erro: "O administrador não pode conceder reconhecimento a si mesmo." };
  }
  if (typeof tipo !== "string" || !Object.prototype.hasOwnProperty.call(TIPOS_RECONHECIMENTO, tipo)) {
    return { ok: false, erro: "Tipo de reconhecimento inválido." };
  }
  if (!isIsoDate(dataReferencia)) return { ok: false, erro: "Data do reconhecimento inválida." };
  if (!isIsoDate(hoje)) return { ok: false, erro: "Data atual inválida." };
  if (dataReferencia > hoje) return { ok: false, erro: "A data do reconhecimento não pode ser futura." };
  return { ok: true };
}
