// FLUXO LAB V5.1.0 — SERVIÇO DE ARMAZENAMENTO STL E METADADOS
// Consultas D1 de arquivos STL, resumo de armazenamento e listagem física no R2.
// Implementações originais preservadas; sem alteração de SQL ou comportamento.

const STL_LIMITE_FALLBACK_V32 = 9000000000;
const STL_AVISO_FALLBACK_V32 = 8000000000;
const STL_CRITICO_FALLBACK_V32 = 8500000000;
const STL_ARQUIVO_FALLBACK_V32 = 100000000;

export function categoriaStlNomeV32ServiceV51(valor) {
  const mapa = {
    BASE: "Base",
    DENTES: "Dentes",
    GENGIVA: "Gengiva",
    PPR_FLEX: "PPR flex",
    PROJETO: "Projeto",
    OUTRO: "Outro"
  };
  return mapa[valor] || "Outro";
}

export function arcadaStlNomeV32ServiceV51(valor) {
  const mapa = {
    SUPERIOR: "Superior",
    INFERIOR: "Inferior",
    AMBAS: "Ambas",
    NAO_APLICAVEL: "Não aplicável"
  };
  return mapa[valor] || "—";
}

export async function obterConfigArmazenamentoStlV32ServiceV51(env) {
  const row = await env.db.prepare(`
    SELECT *
    FROM configuracao_armazenamento_stl
    WHERE id = 1
    LIMIT 1
  `).first();

  return {
    limite_bytes: Number(row?.limite_bytes || STL_LIMITE_FALLBACK_V32),
    aviso_bytes: Number(row?.aviso_bytes || STL_AVISO_FALLBACK_V32),
    alerta_critico_bytes: Number(row?.alerta_critico_bytes || STL_CRITICO_FALLBACK_V32),
    limite_arquivo_bytes: Number(row?.limite_arquivo_bytes || STL_ARQUIVO_FALLBACK_V32)
  };
}

export async function resumoArmazenamentoStlV32ServiceV51(env) {
  const [config, soma] = await Promise.all([
    obterConfigArmazenamentoStlV32ServiceV51(env),
    env.db.prepare(`
      SELECT
        (SELECT COALESCE(SUM(CASE WHEN status IN ('ATIVO','ARQUIVADO') THEN tamanho_bytes ELSE 0 END),0) FROM arquivos_stl)
        +
        (SELECT COALESCE(SUM(CASE WHEN status IN ('PENDENTE','ATIVO') THEN tamanho_bytes ELSE 0 END),0) FROM arquivos_pacotes_digitais)
        AS usado_bytes,

        (SELECT COUNT(*) FROM arquivos_stl WHERE status='ATIVO')
        +
        (SELECT COUNT(*) FROM arquivos_pacotes_digitais WHERE status='ATIVO')
        AS ativos,

        (SELECT COUNT(*) FROM arquivos_stl WHERE status='ARQUIVADO') AS arquivados,

        (SELECT COUNT(*) FROM arquivos_pacotes_digitais WHERE status='PENDENTE') AS reservados,

        (SELECT COUNT(*) FROM arquivos_stl WHERE status='EXCLUIDO')
        +
        (SELECT COUNT(*) FROM arquivos_pacotes_digitais WHERE status='EXCLUIDO')
        AS excluidos,

        (SELECT COUNT(*) FROM arquivos_stl)
        +
        (SELECT COUNT(*) FROM arquivos_pacotes_digitais)
        AS total_registros
    `).first()
  ]);

  const usado = Number(soma?.usado_bytes || 0);
  const disponivel = Math.max(0, config.limite_bytes - usado);
  const percentual = config.limite_bytes > 0
    ? Math.min(100, Math.max(0, (usado / config.limite_bytes) * 100))
    : 0;

  let nivel = "NORMAL";
  if (usado >= config.limite_bytes) nivel = "BLOQUEADO";
  else if (usado >= config.alerta_critico_bytes) nivel = "CRITICO";
  else if (usado >= config.aviso_bytes) nivel = "AVISO";

  return {
    ...config,
    usado_bytes: usado,
    disponivel_bytes: disponivel,
    percentual,
    nivel,
    ativos: Number(soma?.ativos || 0),
    arquivados: Number(soma?.arquivados || 0),
    reservados: Number(soma?.reservados || 0),
    excluidos: Number(soma?.excluidos || 0),
    total_registros: Number(soma?.total_registros || 0)
  };
}

export async function listarArquivosStlTrabalhoV32ServiceV51(env, trabalhoId) {
  const r = await env.db.prepare(`
    SELECT
      a.*,
      ue.nome AS enviado_por_nome,
      ua.nome AS arquivado_por_nome,
      ux.nome AS excluido_por_nome,
      t.entregue AS trabalho_entregue,
      t.data_entrega AS trabalho_data_entrega,
      r.data_entrega_real AS remessa_data_entrega
    FROM arquivos_stl a
    INNER JOIN trabalhos t ON t.id = a.trabalho_id
    LEFT JOIN remessas r ON r.id = t.remessa_id
    LEFT JOIN usuarios ue ON ue.id = a.enviado_por
    LEFT JOIN usuarios ua ON ua.id = a.arquivado_por
    LEFT JOIN usuarios ux ON ux.id = a.excluido_por
    WHERE a.trabalho_id = ?
    ORDER BY
      CASE a.status WHEN 'ATIVO' THEN 1 WHEN 'ARQUIVADO' THEN 2 ELSE 3 END,
      a.id DESC
  `).bind(trabalhoId).all();
  return r.results || [];
}

export async function obterArquivoStlV32ServiceV51(env, id) {
  return await env.db.prepare(`
    SELECT
      a.*,
      t.codigo,
      t.paciente,
      t.municipio,
      t.entregue AS trabalho_entregue,
      t.data_entrega AS trabalho_data_entrega,
      t.remessa_id AS trabalho_remessa_id,
      r.data_entrega_real AS remessa_data_entrega
    FROM arquivos_stl a
    INNER JOIN trabalhos t ON t.id = a.trabalho_id
    LEFT JOIN remessas r ON r.id = t.remessa_id
    WHERE a.id = ?
    LIMIT 1
  `).bind(id).first();
}

export function stlLiberadoExclusaoV32ServiceV51(item) {
  return Number(item?.trabalho_entregue || 0) === 1 || !!item?.remessa_data_entrega;
}

export async function listarStlLiberadosV32ServiceV51(env) {
  const r = await env.db.prepare(`
    SELECT
      a.*,
      t.codigo,
      t.paciente,
      t.municipio,
      t.entregue AS trabalho_entregue,
      r.numero AS remessa_numero,
      r.data_entrega_real AS remessa_data_entrega
    FROM arquivos_stl a
    INNER JOIN trabalhos t ON t.id = a.trabalho_id
    LEFT JOIN remessas r ON r.id = t.remessa_id
    WHERE a.status IN ('ATIVO','ARQUIVADO')
      AND (t.entregue = 1 OR r.data_entrega_real IS NOT NULL)
    ORDER BY a.tamanho_bytes DESC, a.enviado_em ASC
    LIMIT 250
  `).all();
  return r.results || [];
}

export async function totalRealBucketV32ServiceV51(bucket) {
  if (!bucket) throw new Error("Binding STL_BUCKET não disponível.");
  let cursor = undefined;
  let total = 0;
  let quantidade = 0;
  do {
    const pagina = await bucket.list({ limit: 1000, ...(cursor ? { cursor } : {}) });
    for (const obj of pagina.objects || []) {
      total += Number(obj.size || 0);
      quantidade += 1;
    }
    cursor = pagina.truncated ? pagina.cursor : undefined;
  } while (cursor);
  return { total_bytes: total, quantidade };
}
