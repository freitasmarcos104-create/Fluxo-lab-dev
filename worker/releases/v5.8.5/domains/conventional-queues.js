// FLUXO LAB V4.5.0 — FILAS DA PRODUÇÃO CONVENCIONAL
// Consultas das filas preservadas, incluindo filtros, ordenação, limites e agrupamentos.
// Não altera estados, responsáveis, etapas ou registros.

export async function listarFilaSetorConvencionalDomainV45(env, setor, busca = "") {
  const q = String(busca || "").trim().toLowerCase();
  const termo = `%${q}%`;
  const filtro = q ? `
    AND (
      lower(t.paciente) LIKE ? OR lower(t.municipio) LIKE ? OR CAST(t.numero_articulador AS TEXT) LIKE ?
    )
  ` : "";
  let stmt = env.db.prepare(`
    SELECT
      e.*,
      p.arcada,
      p.tipo_protese,
      p.setor_atual,
      t.id AS trabalho_id,
      t.numero_articulador,
      t.paciente,
      t.municipio,
      t.uf,
      t.ciclo_id,
      c.nome AS ciclo_nome,
      u.nome AS responsavel_nome
    FROM etapas_convencionais e
    INNER JOIN pecas_convencionais p ON p.id = e.peca_id
    INNER JOIN trabalhos_convencionais t ON t.id = p.trabalho_id
    INNER JOIN ciclos_convencionais c ON c.id = t.ciclo_id
    LEFT JOIN usuarios u ON u.id = e.responsavel_id
    WHERE
      e.setor = ?
      AND e.status IN ('AGUARDANDO', 'EM_ANDAMENTO')
      AND t.excluido = 0
      ${filtro}
    ORDER BY
      CASE e.status WHEN 'EM_ANDAMENTO' THEN 1 ELSE 2 END,
      c.ativo DESC,
      t.municipio ASC,
      t.numero_articulador ASC,
      CASE p.arcada WHEN 'SUPERIOR' THEN 1 ELSE 2 END
    LIMIT 1000
  `);
  stmt = q ? stmt.bind(setor, termo, termo, termo) : stmt.bind(setor);
  const resultado = await stmt.all();
  return resultado.results || [];
}

export async function listarFilaArticulacaoConvencionalDomainV45(env, busca = "") {
  const q = String(busca || "").trim().toLowerCase();
  const termo = `%${q}%`;
  const filtro = q ? `
    AND (
      lower(t.paciente) LIKE ? OR
      lower(t.municipio) LIKE ? OR
      CAST(t.numero_articulador AS TEXT) LIKE ?
    )
  ` : "";

  let stmt = env.db.prepare(`
    SELECT
      t.id AS trabalho_id,
      t.numero_articulador,
      t.paciente,
      t.municipio,
      t.uf,
      t.ciclo_id,
      c.nome AS ciclo_nome,
      COUNT(p.id) AS total_pecas,
      MAX(CASE WHEN p.arcada = 'SUPERIOR' THEN p.tipo_protese END) AS tipo_superior,
      MAX(CASE WHEN p.arcada = 'INFERIOR' THEN p.tipo_protese END) AS tipo_inferior,
      MAX(CASE WHEN p.arcada = 'SUPERIOR' THEN 1 ELSE 0 END) AS tem_superior,
      MAX(CASE WHEN p.arcada = 'INFERIOR' THEN 1 ELSE 0 END) AS tem_inferior,
      CASE
        WHEN SUM(CASE WHEN e.status = 'EM_ANDAMENTO' THEN 1 ELSE 0 END) > 0
          THEN 'EM_ANDAMENTO'
        WHEN SUM(CASE WHEN e.status = 'AGUARDANDO' THEN 1 ELSE 0 END) > 0
          THEN 'AGUARDANDO'
        ELSE 'CONCLUIDO'
      END AS status,
      MAX(CASE WHEN e.status = 'EM_ANDAMENTO' THEN u.nome END) AS responsavel_nome,
      MAX(CASE WHEN e.status = 'EM_ANDAMENTO' THEN e.responsavel_id END) AS responsavel_id,
      SUM(CASE WHEN e.status = 'CONCLUIDO' THEN 1 ELSE 0 END) AS pecas_concluidas
    FROM trabalhos_convencionais t
    INNER JOIN ciclos_convencionais c ON c.id = t.ciclo_id
    INNER JOIN pecas_convencionais p ON p.trabalho_id = t.id
    INNER JOIN etapas_convencionais e
      ON e.peca_id = p.id
      AND e.setor = 'ARTICULACAO'
    LEFT JOIN usuarios u ON u.id = e.responsavel_id
    WHERE
      t.excluido = 0
      AND e.status IN ('AGUARDANDO', 'EM_ANDAMENTO', 'CONCLUIDO')
      ${filtro}
    GROUP BY t.id
    HAVING SUM(CASE WHEN e.status != 'CONCLUIDO' THEN 1 ELSE 0 END) > 0
    ORDER BY
      CASE
        WHEN SUM(CASE WHEN e.status = 'EM_ANDAMENTO' THEN 1 ELSE 0 END) > 0 THEN 1
        ELSE 2
      END,
      c.ativo DESC,
      t.municipio ASC,
      t.numero_articulador ASC
    LIMIT 1000
  `);

  stmt = q ? stmt.bind(termo, termo, termo) : stmt;
  const resultado = await stmt.all();
  return resultado.results || [];
}

export async function listarFilaSetorPacienteConvencionalDomainV45(env, setor, busca = "", deps = {}) {
  const anterior = deps.setorAnteriorConvencional(setor);
  if (!anterior) return [];
  const q = String(busca || "").trim().toLowerCase();
  const termo = `%${q}%`;
  const filtro = q ? `
    AND (
      lower(t.paciente) LIKE ? OR
      lower(t.municipio) LIKE ? OR
      CAST(t.numero_articulador AS TEXT) LIKE ?
    )
  ` : "";

  let stmt = env.db.prepare(`
    SELECT
      t.id AS trabalho_id,
      t.numero_articulador,
      t.paciente,
      t.municipio,
      t.uf,
      t.ciclo_id,
      c.nome AS ciclo_nome,
      COUNT(p.id) AS total_pecas,
      MAX(CASE WHEN p.arcada = 'SUPERIOR' THEN p.tipo_protese END) AS tipo_superior,
      MAX(CASE WHEN p.arcada = 'INFERIOR' THEN p.tipo_protese END) AS tipo_inferior,
      MAX(CASE WHEN p.arcada = 'SUPERIOR' THEN 1 ELSE 0 END) AS tem_superior,
      MAX(CASE WHEN p.arcada = 'INFERIOR' THEN 1 ELSE 0 END) AS tem_inferior,

      CASE
        WHEN SUM(CASE WHEN ec.status = 'EM_ANDAMENTO' THEN 1 ELSE 0 END) > 0 THEN 'EM_ANDAMENTO'
        WHEN SUM(CASE WHEN ec.status = 'AGUARDANDO' THEN 1 ELSE 0 END) > 0 THEN 'AGUARDANDO'
        ELSE 'CONCLUIDO'
      END AS status,

      MAX(CASE WHEN p.arcada = 'SUPERIOR' THEN ec.responsavel_id END) AS responsavel_superior_id,
      MAX(CASE WHEN p.arcada = 'INFERIOR' THEN ec.responsavel_id END) AS responsavel_inferior_id,
      MAX(CASE WHEN p.arcada = 'SUPERIOR' THEN uc_sup.nome END) AS responsavel_superior_nome,
      MAX(CASE WHEN p.arcada = 'INFERIOR' THEN uc_inf.nome END) AS responsavel_inferior_nome,

      MAX(CASE WHEN p.arcada = 'SUPERIOR' THEN ep.responsavel_id END) AS anterior_superior_id,
      MAX(CASE WHEN p.arcada = 'INFERIOR' THEN ep.responsavel_id END) AS anterior_inferior_id,
      MAX(CASE WHEN p.arcada = 'SUPERIOR' THEN up_sup.nome END) AS anterior_superior_nome,
      MAX(CASE WHEN p.arcada = 'INFERIOR' THEN up_inf.nome END) AS anterior_inferior_nome,
      MAX(CASE WHEN p.arcada = 'SUPERIOR' THEN ep.concluido_em END) AS anterior_superior_concluido,
      MAX(CASE WHEN p.arcada = 'INFERIOR' THEN ep.concluido_em END) AS anterior_inferior_concluido,

      SUM(CASE WHEN ec.status = 'CONCLUIDO' THEN 1 ELSE 0 END) AS pecas_concluidas

    FROM trabalhos_convencionais t
    INNER JOIN ciclos_convencionais c ON c.id = t.ciclo_id
    INNER JOIN pecas_convencionais p ON p.trabalho_id = t.id
    INNER JOIN etapas_convencionais ec ON ec.peca_id = p.id AND ec.setor = ?
    LEFT JOIN etapas_convencionais ep ON ep.peca_id = p.id AND ep.setor = ?
    LEFT JOIN usuarios uc_sup ON uc_sup.id = CASE WHEN p.arcada = 'SUPERIOR' THEN ec.responsavel_id END
    LEFT JOIN usuarios uc_inf ON uc_inf.id = CASE WHEN p.arcada = 'INFERIOR' THEN ec.responsavel_id END
    LEFT JOIN usuarios up_sup ON up_sup.id = CASE WHEN p.arcada = 'SUPERIOR' THEN ep.responsavel_id END
    LEFT JOIN usuarios up_inf ON up_inf.id = CASE WHEN p.arcada = 'INFERIOR' THEN ep.responsavel_id END
    WHERE
      t.excluido = 0
      AND ec.status IN ('AGUARDANDO', 'EM_ANDAMENTO', 'CONCLUIDO')
      ${filtro}
    GROUP BY t.id
    HAVING SUM(CASE WHEN ec.status != 'CONCLUIDO' THEN 1 ELSE 0 END) > 0
    ORDER BY
      CASE
        WHEN SUM(CASE WHEN ec.status = 'EM_ANDAMENTO' THEN 1 ELSE 0 END) > 0 THEN 1
        ELSE 2
      END,
      c.ativo DESC,
      t.municipio ASC,
      t.numero_articulador ASC
    LIMIT 1000
  `);

  stmt = q
    ? stmt.bind(setor, anterior, termo, termo, termo)
    : stmt.bind(setor, anterior);
  const resultado = await stmt.all();
  return resultado.results || [];
}

export async function listarFilaInclusaoConvencionalDomainV45(env, busca = "") {
  const q = String(busca || "").trim().toLowerCase();
  const termo = `%${q}%`;
  const filtro = q ? `
    AND (
      lower(t.paciente) LIKE ? OR
      lower(t.municipio) LIKE ? OR
      CAST(t.numero_articulador AS TEXT) LIKE ?
    )
  ` : "";

  let stmt = env.db.prepare(`
    SELECT
      t.id AS trabalho_id,
      t.numero_articulador,
      t.paciente,
      t.municipio,
      t.uf,
      c.nome AS ciclo_nome,
      MAX(CASE WHEN p.arcada = 'SUPERIOR' THEN p.id END) AS peca_superior_id,
      MAX(CASE WHEN p.arcada = 'INFERIOR' THEN p.id END) AS peca_inferior_id,
      MAX(CASE WHEN p.arcada = 'SUPERIOR' THEN p.tipo_protese END) AS tipo_superior,
      MAX(CASE WHEN p.arcada = 'INFERIOR' THEN p.tipo_protese END) AS tipo_inferior,
      MAX(CASE WHEN p.arcada = 'SUPERIOR' THEN ei.status END) AS inclusao_superior_status,
      MAX(CASE WHEN p.arcada = 'INFERIOR' THEN ei.status END) AS inclusao_inferior_status,
      MAX(CASE WHEN p.arcada = 'SUPERIOR' THEN ue.nome END) AS escultura_superior_nome,
      MAX(CASE WHEN p.arcada = 'INFERIOR' THEN ue.nome END) AS escultura_inferior_nome,
      MAX(CASE WHEN p.arcada = 'SUPERIOR' THEN m.numero_mufla END) AS mufla_superior,
      MAX(CASE WHEN p.arcada = 'INFERIOR' THEN m.numero_mufla END) AS mufla_inferior
    FROM trabalhos_convencionais t
    INNER JOIN ciclos_convencionais c ON c.id = t.ciclo_id
    INNER JOIN pecas_convencionais p ON p.trabalho_id = t.id
    INNER JOIN etapas_convencionais ei ON ei.peca_id = p.id AND ei.setor = 'INCLUSAO'
    LEFT JOIN etapas_convencionais ee ON ee.peca_id = p.id AND ee.setor = 'ESCULTURA'
    LEFT JOIN usuarios ue ON ue.id = ee.responsavel_id
    LEFT JOIN muflas_convencionais m ON m.peca_id = p.id AND m.ativo = 1
    WHERE t.excluido = 0
      AND ei.status IN ('AGUARDANDO','EM_ANDAMENTO','CONCLUIDO')
      ${filtro}
    GROUP BY t.id
    HAVING SUM(CASE WHEN ei.status != 'CONCLUIDO' THEN 1 ELSE 0 END) > 0
    ORDER BY c.ativo DESC, t.municipio ASC, t.numero_articulador ASC
    LIMIT 1000
  `);
  stmt = q ? stmt.bind(termo, termo, termo) : stmt;
  const resultado = await stmt.all();
  return resultado.results || [];
}

export async function listarFilaMuflasConvencionalDomainV45(env, setor, busca = "") {
  const q = String(busca || "").trim().toLowerCase();
  const termo = `%${q}%`;
  const anterior = setor === 'ACRILIZACAO' ? 'INCLUSAO' : 'ACRILIZACAO';
  const filtro = q ? `
    AND (
      lower(t.paciente) LIKE ? OR
      lower(t.municipio) LIKE ? OR
      CAST(t.numero_articulador AS TEXT) LIKE ? OR
      CAST(carga.numero_mufla AS TEXT) LIKE ?
    )
  ` : "";

  let stmt = env.db.prepare(`
    SELECT
      carga.id AS carga_id,
      carga.numero_mufla,
      carga.status AS carga_status,
      carga.ativo AS carga_ativa,
      carga.incluido_por AS carga_incluido_por,
      carga.incluido_em AS carga_incluido_em,
      carga.acrilizado_por AS carga_acrilizado_por,
      carga.acrilizado_em AS carga_acrilizado_em,
      carga.desincluido_por AS carga_desincluido_por,
      carga.desincluido_em AS carga_desincluido_em,
      m.id AS mufla_item_id,
      m.status AS mufla_item_status,
      m.ativo AS mufla_item_ativo,
      e.id AS etapa_id,
      e.status AS etapa_status,
      e.responsavel_id,
      u.nome AS responsavel_nome,
      p.id AS peca_id,
      p.arcada,
      p.tipo_protese,
      t.id AS trabalho_id,
      t.numero_articulador,
      t.paciente,
      t.municipio,
      t.uf,
      c.nome AS ciclo_nome,
      ep.concluido_em AS anterior_concluido_em,
      up.nome AS anterior_responsavel_nome,
      pp.id AS par_peca_id,
      pp.arcada AS par_arcada,
      pp.tipo_protese AS par_tipo_protese,
      mp.numero_mufla AS par_mufla,
      edp.status AS par_desinclusao_status
    FROM cargas_muflas_convencionais carga
    INNER JOIN muflas_convencionais m ON m.carga_id = carga.id AND m.ativo = 1
    INNER JOIN pecas_convencionais p ON p.id = m.peca_id
    INNER JOIN trabalhos_convencionais t ON t.id = p.trabalho_id
    INNER JOIN ciclos_convencionais c ON c.id = t.ciclo_id
    INNER JOIN etapas_convencionais e ON e.peca_id = p.id AND e.setor = ?
    LEFT JOIN usuarios u ON u.id = e.responsavel_id
    LEFT JOIN etapas_convencionais ep ON ep.peca_id = p.id AND ep.setor = ?
    LEFT JOIN usuarios up ON up.id = ep.responsavel_id
    LEFT JOIN pecas_convencionais pp ON pp.trabalho_id = t.id AND pp.id != p.id
    LEFT JOIN muflas_convencionais mp ON mp.peca_id = pp.id AND mp.ativo = 1
    LEFT JOIN etapas_convencionais edp ON edp.peca_id = pp.id AND edp.setor = 'DESINCLUSAO'
    WHERE carga.ativo = 1
      AND t.excluido = 0
      AND e.status IN ('AGUARDANDO','EM_ANDAMENTO')
      ${filtro}
    ORDER BY
      CASE e.status WHEN 'EM_ANDAMENTO' THEN 1 ELSE 2 END,
      carga.numero_mufla ASC,
      t.numero_articulador ASC,
      CASE p.arcada WHEN 'SUPERIOR' THEN 1 ELSE 2 END
    LIMIT 2000
  `);
  stmt = q
    ? stmt.bind(setor, anterior, termo, termo, termo, termo)
    : stmt.bind(setor, anterior);
  const resultado = await stmt.all();
  const rows = resultado.results || [];

  const mapa = new Map();
  for (const row of rows) {
    const id = Number(row.carga_id);
    if (!mapa.has(id)) {
      mapa.set(id, {
        carga_id: id,
        numero_mufla: Number(row.numero_mufla),
        carga_status: row.carga_status,
        ativo: Number(row.carga_ativa),
        pecas: [],
        status: 'AGUARDANDO',
        responsavel_ids: [],
        responsavel_nomes: []
      });
    }
    const carga = mapa.get(id);
    carga.pecas.push(row);
    if (row.etapa_status === 'EM_ANDAMENTO') carga.status = 'EM_ANDAMENTO';
    const rid = Number(row.responsavel_id || 0);
    if (rid && !carga.responsavel_ids.includes(rid)) carga.responsavel_ids.push(rid);
    if (row.responsavel_nome && !carga.responsavel_nomes.includes(row.responsavel_nome)) carga.responsavel_nomes.push(row.responsavel_nome);
  }
  return [...mapa.values()];
}

export async function listarFilaQualidadeConvencionalDomainV45(env, busca = "") {
  const q = String(busca || "").trim().toLowerCase();
  const termo = `%${q}%`;
  const filtro = q ? `
    AND (
      lower(t.paciente) LIKE ? OR
      lower(t.municipio) LIKE ? OR
      CAST(t.numero_articulador AS TEXT) LIKE ?
    )
  ` : "";

  let stmt = env.db.prepare(`
    SELECT
      t.id AS trabalho_id,
      t.numero_articulador,
      t.paciente,
      t.municipio,
      t.uf,
      t.ciclo_id,
      c.nome AS ciclo_nome,
      p.id AS peca_id,
      p.arcada,
      p.tipo_protese,
      eq.id AS etapa_qualidade_id,
      eq.status AS qualidade_status,
      eq.responsavel_id AS qualidade_responsavel_id,
      uq.nome AS qualidade_responsavel_nome,
      ea.responsavel_id AS acabamento_responsavel_id,
      ua.nome AS acabamento_responsavel_nome,
      ea.concluido_em AS acabamento_concluido_em,
      (SELECT iq.resultado FROM inspecoes_qualidade_convencional iq WHERE iq.peca_id = p.id ORDER BY iq.id DESC LIMIT 1) AS ultima_inspecao_resultado,
      (SELECT iq.motivo FROM inspecoes_qualidade_convencional iq WHERE iq.peca_id = p.id ORDER BY iq.id DESC LIMIT 1) AS ultima_inspecao_motivo,
      (SELECT iq.setor_retorno FROM inspecoes_qualidade_convencional iq WHERE iq.peca_id = p.id ORDER BY iq.id DESC LIMIT 1) AS ultima_inspecao_setor,
      (SELECT iq.criado_em FROM inspecoes_qualidade_convencional iq WHERE iq.peca_id = p.id ORDER BY iq.id DESC LIMIT 1) AS ultima_inspecao_em,
      (SELECT ui.nome FROM inspecoes_qualidade_convencional iq LEFT JOIN usuarios ui ON ui.id = iq.responsavel_id WHERE iq.peca_id = p.id ORDER BY iq.id DESC LIMIT 1) AS ultima_inspecao_responsavel
    FROM trabalhos_convencionais t
    INNER JOIN ciclos_convencionais c ON c.id = t.ciclo_id
    INNER JOIN pecas_convencionais p ON p.trabalho_id = t.id
    INNER JOIN etapas_convencionais eq ON eq.peca_id = p.id AND eq.setor = 'QUALIDADE'
    LEFT JOIN usuarios uq ON uq.id = eq.responsavel_id
    LEFT JOIN etapas_convencionais ea ON ea.peca_id = p.id AND ea.setor = 'ACABAMENTO'
    LEFT JOIN usuarios ua ON ua.id = ea.responsavel_id
    WHERE t.excluido = 0
      AND EXISTS (
        SELECT 1
        FROM pecas_convencionais p2
        INNER JOIN etapas_convencionais q2 ON q2.peca_id = p2.id AND q2.setor = 'QUALIDADE'
        WHERE p2.trabalho_id = t.id AND q2.status = 'AGUARDANDO'
      )
      ${filtro}
    ORDER BY c.ativo DESC, t.municipio ASC, t.numero_articulador ASC,
      CASE p.arcada WHEN 'SUPERIOR' THEN 1 ELSE 2 END
    LIMIT 1200
  `);
  stmt = q ? stmt.bind(termo, termo, termo) : stmt;
  const resultado = await stmt.all();
  return resultado.results || [];
}
