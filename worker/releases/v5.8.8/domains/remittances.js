// FLUXO LAB V4.5.0 — CONSULTAS DE REMESSAS
// Consultas D1 e composição dos resultados extraídas sem alterar SQL, filtros ou retornos.
// As dependências de permissão e setores são injetadas pelo legado.

export async function resumoDesignacoesRemessasMunicipioV346DomainV45(env, municipio, remessaIdFiltro = 0, deps = {}) {
  // V3.4.13: uma única consulta traz carga ativa + histórico concluído da remessa.
  // Ativos exigem designação explícita; concluídos usam responsavel_id como autor da produção.
  const resultado = await env.db.prepare(`
    SELECT DISTINCT
      r.id AS remessa_id,
      e.responsavel_id,
      u.nome AS responsavel_nome,
      e.setor,
      e.arcada,
      e.status,
      e.trabalho_id,
      t.codigo,
      t.paciente
    FROM remessas r
    INNER JOIN trabalhos t
      ON t.remessa_id = r.id
     AND t.excluido = 0
    INNER JOIN etapas e
      ON e.trabalho_id = t.id
     AND e.responsavel_id IS NOT NULL
     AND (
       (
         e.status IN ('AGUARDANDO','EM_ANDAMENTO')
         AND e.designado_por IS NOT NULL
         AND t.entregue = 0
       )
       OR e.status = 'CONCLUIDO'
     )
    INNER JOIN usuarios u
      ON u.id = e.responsavel_id
    WHERE lower(trim(r.municipio)) = lower(trim(?))
      AND (? = 0 OR r.id = ?)
    ORDER BY r.id, u.nome COLLATE NOCASE, t.paciente COLLATE NOCASE, e.setor, e.arcada
  `).bind(municipio, Number(remessaIdFiltro || 0), Number(remessaIdFiltro || 0)).all();

  const porRemessa = new Map();

  for (const row of (resultado.results || [])) {
    const remessaId = Number(row.remessa_id || 0);
    const usuarioId = Number(row.responsavel_id || 0);
    if (!remessaId || !usuarioId) continue;

    if (!porRemessa.has(remessaId)) porRemessa.set(remessaId, new Map());
    const funcionarios = porRemessa.get(remessaId);

    if (!funcionarios.has(usuarioId)) {
      funcionarios.set(usuarioId, {
        funcionario_id: usuarioId,
        funcionario_nome: String(row.responsavel_nome || 'Funcionário'),
        pacientes: new Map(),
        setores: new Map(),
        concluidos_pacientes: new Set(),
        concluidos_setores: new Map()
      });
    }

    const item = funcionarios.get(usuarioId);
    const trabalhoId = Number(row.trabalho_id || 0);
    const setor = String(row.setor || '').toUpperCase();
    const arcada = String(row.arcada || '').toUpperCase();
    const status = String(row.status || '').toUpperCase();

    if (!trabalhoId) continue;

    if (status === 'CONCLUIDO') {
      item.concluidos_pacientes.add(trabalhoId);
      if (setor) {
        if (!item.concluidos_setores.has(setor)) item.concluidos_setores.set(setor, new Set());
        item.concluidos_setores.get(setor).add(trabalhoId);
      }
      continue;
    }

    if (!item.pacientes.has(trabalhoId)) {
      item.pacientes.set(trabalhoId, {
        trabalho_id: trabalhoId,
        codigo: String(row.codigo || ''),
        paciente: String(row.paciente || 'Paciente'),
        tarefas: new Map()
      });
    }

    const paciente = item.pacientes.get(trabalhoId);
    if (setor) {
      if (!paciente.tarefas.has(setor)) {
        paciente.tarefas.set(setor, { setor, arcadas: new Set(), status: new Set() });
      }
      const tarefa = paciente.tarefas.get(setor);
      if (arcada) tarefa.arcadas.add(arcada);
      if (status) tarefa.status.add(status);

      if (!item.setores.has(setor)) item.setores.set(setor, new Set());
      item.setores.get(setor).add(trabalhoId);
    }
  }

  const saida = new Map();

  for (const [remessaId, funcionarios] of porRemessa.entries()) {
    saida.set(remessaId, [...funcionarios.values()]
      .map(item => {
        const trabalhos = [...item.pacientes.values()]
          .map(paciente => ({
            trabalho_id: paciente.trabalho_id,
            codigo: paciente.codigo,
            paciente: paciente.paciente,
            tarefas: deps.SETORES
              .filter(setor => paciente.tarefas.has(setor))
              .map(setor => {
                const tarefa = paciente.tarefas.get(setor);
                return {
                  setor,
                  arcadas: [...tarefa.arcadas],
                  status: [...tarefa.status]
                };
              })
          }))
          .sort((a, b) => a.paciente.localeCompare(b.paciente, 'pt-BR'));

        return {
          funcionario_id: item.funcionario_id,
          funcionario_nome: item.funcionario_nome,
          total_pacientes: trabalhos.length,
          total_concluidos: item.concluidos_pacientes.size,
          setores: deps.SETORES
            .filter(setor => item.setores.has(setor))
            .map(setor => ({ setor, total: item.setores.get(setor).size })),
          setores_concluidos: deps.SETORES
            .filter(setor => item.concluidos_setores.has(setor))
            .map(setor => ({ setor, total: item.concluidos_setores.get(setor).size })),
          trabalhos
        };
      })
      .sort((a, b) =>
        b.total_pacientes - a.total_pacientes
        || b.total_concluidos - a.total_concluidos
        || a.funcionario_nome.localeCompare(b.funcionario_nome, 'pt-BR')
      ));
  }

  return saida;
}

export async function listarRemessasMunicipioIntegradoDomainV45(env, municipio, deps = {}) {
  const [resultado, designacoesPorRemessa] = await Promise.all([
    env.db.prepare(`
      SELECT
        r.*,
        uc.nome AS criador_nome,
        uf.nome AS finalizado_por_nome,
        ue.nome AS entregue_por_nome,

        (SELECT COUNT(*) FROM trabalhos t
         WHERE t.remessa_id = r.id AND t.excluido = 0) AS digital_total,

        (SELECT COUNT(*) FROM trabalhos t
         WHERE t.remessa_id = r.id AND t.excluido = 0
           AND t.entregue = 1) AS digital_entregues,

        (SELECT COUNT(*) FROM trabalhos t
         WHERE t.remessa_id = r.id AND t.excluido = 0
           AND (
             t.entregue = 1
             OR NOT EXISTS (
               SELECT 1 FROM etapas e
               WHERE e.trabalho_id = t.id AND e.status != 'CONCLUIDO'
             )
           )) AS digital_prontos,

        (SELECT COUNT(*) FROM trabalhos_convencionais tc
         WHERE tc.remessa_id = r.id AND tc.excluido = 0) AS convencional_total,

        (SELECT COUNT(*) FROM trabalhos_convencionais tc
         WHERE tc.remessa_id = r.id AND tc.excluido = 0
           AND tc.status = 'QUALIDADE') AS convencional_qualidade,

        (SELECT COUNT(*) FROM trabalhos_convencionais tc
         WHERE tc.remessa_id = r.id AND tc.excluido = 0
           AND tc.status IN ('LIBERADO_ENTREGA','CONCLUIDO')) AS convencional_prontos

      FROM remessas r
      LEFT JOIN usuarios uc ON uc.id = r.criado_por
      LEFT JOIN usuarios uf ON uf.id = r.finalizado_por
      LEFT JOIN usuarios ue ON ue.id = r.entregue_por
      WHERE lower(trim(r.municipio)) = lower(trim(?))
      ORDER BY r.numero DESC, date(r.data_recebimento) DESC, r.id DESC
    `).bind(municipio).all(),
    resumoDesignacoesRemessasMunicipioV346DomainV45(env, municipio, 0, deps)
  ]);

  return (resultado.results || []).map(remessa => ({
    ...remessa,
    designacoes_funcionarios: designacoesPorRemessa.get(Number(remessa.id)) || []
  }));
}

export async function obterResumoRemessaIntegradaDomainV45(env, id) {
  return await env.db.prepare(`
    SELECT
      r.*,
      (SELECT COUNT(*) FROM trabalhos t
       WHERE t.remessa_id = r.id AND t.excluido = 0) AS digital_total,
      (SELECT COUNT(*) FROM trabalhos t
       WHERE t.remessa_id = r.id AND t.excluido = 0
         AND (
           t.entregue = 1
           OR NOT EXISTS (
             SELECT 1 FROM etapas e
             WHERE e.trabalho_id = t.id AND e.status != 'CONCLUIDO'
           )
         )) AS digital_prontos,
      (SELECT COUNT(*) FROM trabalhos_convencionais tc
       WHERE tc.remessa_id = r.id AND tc.excluido = 0) AS convencional_total,
      (SELECT COUNT(*) FROM trabalhos_convencionais tc
       WHERE tc.remessa_id = r.id AND tc.excluido = 0
         AND tc.status IN ('LIBERADO_ENTREGA','CONCLUIDO')) AS convencional_prontos
    FROM remessas r
    WHERE r.id = ?
    LIMIT 1
  `).bind(id).first();
}

export async function listarRemessasDomainV45(
  env,
  mes = "",
  usuario = null,
  deps = {}
) {
  const mesSeguro = /^\d{4}-\d{2}$/.test(String(mes || "")) ? String(mes) : "";
  const visibilidadeV345 = deps.sqlVisibilidadeTrabalhoDigitalLiteralV345(usuario, "t");
  const restringeV345 = usuario && !deps.podeGerenciarAreaV31(usuario, "DIGITAL");

  const resultado = await env.db.prepare(`
    SELECT
      r.id,
      r.municipio,
      r.numero,
      r.data_recebimento,
      r.data_prevista_entrega,
      r.data_finalizacao,
      r.finalizado_por,
      r.data_entrega_real,
      r.entregue_por,
      r.observacao,
      r.criado_em,
      u.nome AS criador,

      (SELECT COUNT(*) FROM trabalhos t
       WHERE t.remessa_id = r.id AND t.excluido = 0 ${visibilidadeV345}) AS digital_total,

      (SELECT COUNT(*) FROM trabalhos t
       WHERE t.remessa_id = r.id AND t.excluido = 0 AND t.entregue = 1 ${visibilidadeV345}) AS digital_entregues,

      (SELECT COUNT(*) FROM trabalhos t
       WHERE t.remessa_id = r.id AND t.excluido = 0
         AND t.entregue = 0
         ${visibilidadeV345}
         AND NOT EXISTS (
           SELECT 1 FROM etapas e
           WHERE e.trabalho_id = t.id AND e.status != 'CONCLUIDO'
         )) AS digital_concluidos,

      (SELECT COUNT(*) FROM trabalhos_convencionais tc
       WHERE tc.remessa_id = r.id AND tc.excluido = 0) AS convencional_total,

      (SELECT COUNT(*) FROM trabalhos_convencionais tc
       WHERE tc.remessa_id = r.id AND tc.excluido = 0
         AND tc.status IN ('LIBERADO_ENTREGA','CONCLUIDO')) AS convencional_liberados,

      CAST(
        julianday(r.data_prevista_entrega) - julianday(date('now'))
        AS INTEGER
      ) AS dias_para_entrega

    FROM remessas r
    LEFT JOIN usuarios u ON u.id = r.criado_por
    WHERE
      (? = '' OR substr(r.data_recebimento, 1, 7) = ?)
      ${restringeV345 ? `AND EXISTS (
        SELECT 1 FROM trabalhos t
        WHERE t.remessa_id=r.id AND t.excluido=0
        ${visibilidadeV345}
      )` : ""}
    ORDER BY
      CASE WHEN r.data_entrega_real IS NULL THEN 0 ELSE 1 END,
      date(r.data_prevista_entrega) ASC,
      r.municipio COLLATE NOCASE,
      r.numero
  `).bind(mesSeguro, mesSeguro).all();

  return resultado.results || [];
}

export async function listarRemessasParaSelecaoDomainV45(
  env
) {

  const resultado =
    await env.db.prepare(`

      SELECT
        id,
        municipio,
        numero,
        data_recebimento,
        data_prevista_entrega

      FROM remessas

      ORDER BY
        date(
          data_prevista_entrega
        ) DESC,
        id DESC

      LIMIT 150

    `)
    .all();

  return (
    resultado.results
    ||
    []
  );
}

export async function listarPacientesDigitaisSemRemessaDomainV45(
  env
) {

  const resultado =
    await env.db.prepare(`

      SELECT
        id,
        codigo,
        municipio,
        paciente,
        criado_em

      FROM trabalhos

      WHERE
        excluido = 0
        AND remessa_id IS NULL
        AND arquivado = 0
        AND entregue = 0

      ORDER BY
        municipio COLLATE NOCASE ASC,
        paciente COLLATE NOCASE ASC,
        id DESC

      LIMIT 500

    `)
    .all();

  return (
    resultado.results
    ||
    []
  );
}

export async function resumoProgressoRemessaV362DomainV45(env, remessaId) {
  const id = Math.max(0, Number(remessaId) || 0);
  if (!id) return null;

  const setores = ["CAD/CAM", "FATIAMENTO", "IMPRESSAO", "ACABAMENTO"];
  const resultado = {
    total: 0,
    setores: {}
  };

  const totalRow = await env.db.prepare(`
    SELECT COUNT(*) AS total
    FROM trabalhos t
    WHERE t.remessa_id = ?
      AND t.excluido = 0
  `).bind(id).first();

  resultado.total = Number(totalRow?.total || 0);

  for (const setor of setores) {
    const row = await env.db.prepare(`
      SELECT
        SUM(
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM etapas e1
              WHERE e1.trabalho_id = t.id
                AND e1.setor = ?
            )
            AND NOT EXISTS (
              SELECT 1
              FROM etapas e2
              WHERE e2.trabalho_id = t.id
                AND e2.setor = ?
                AND e2.status != 'CONCLUIDO'
            )
            THEN 1
            ELSE 0
          END
        ) AS concluidos
      FROM trabalhos t
      WHERE t.remessa_id = ?
        AND t.excluido = 0
    `).bind(setor, setor, id).first();

    const concluidos = Number(row?.concluidos || 0);
    resultado.setores[setor] = {
      concluidos,
      faltam: Math.max(0, resultado.total - concluidos)
    };
  }

  return resultado;
}

export async function listarRemessasDigitaisV31DomainV45(env, cicloId = 0, usuario = null, deps = {}) {
  if (!cicloId) return [];
  const visibilidadeV345 = deps.sqlVisibilidadeTrabalhoDigitalLiteralV345(usuario, "t");
  const restringeV345 = usuario && !deps.podeGerenciarAreaV31(usuario, "DIGITAL");
  const resultado = await env.db.prepare(`
    SELECT
      r.id, r.municipio, r.numero, r.data_recebimento, r.data_prevista_entrega,
      r.data_finalizacao, r.data_entrega_real, r.observacao, r.ciclo_digital_id,
      c.nome AS ciclo_nome, c.data_inicio AS ciclo_inicio, c.data_fim AS ciclo_fim,
      COUNT(t.id) AS total,
      SUM(
        CASE WHEN upper(trim(COALESCE(t.superior_tipo,''))) IN ('PT','PPR') THEN 1 ELSE 0 END
        + CASE WHEN upper(trim(COALESCE(t.inferior_tipo,''))) IN ('PT','PPR') THEN 1 ELSE 0 END
      ) AS total_proteses,
      SUM(CASE WHEN t.id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM etapas e WHERE e.trabalho_id=t.id AND e.status!='CONCLUIDO'
      ) THEN 1 ELSE 0 END) AS prontos,
      SUM(CASE WHEN t.entregue=1 THEN 1 ELSE 0 END) AS entregues,
      CAST(julianday(r.data_prevista_entrega)-julianday(date('now')) AS INTEGER) AS dias_para_entrega
    FROM remessas r
    INNER JOIN ciclos_digitais c ON c.id=r.ciclo_digital_id
    LEFT JOIN trabalhos t ON t.remessa_id=r.id AND t.excluido=0 ${visibilidadeV345}
    WHERE r.ciclo_digital_id=?
    GROUP BY r.id
    ${restringeV345 ? "HAVING COUNT(t.id) > 0" : ""}
    ORDER BY CASE WHEN r.data_entrega_real IS NULL THEN 0 ELSE 1 END,
             date(r.data_prevista_entrega), r.municipio COLLATE NOCASE, r.id DESC
  `).bind(cicloId).all();
  return resultado.results || [];
}

export async function listarRemessasDigitaisSemCicloV311DomainV45(env) {
  const item = await env.db.prepare(`
    SELECT COUNT(*) AS total
    FROM remessas r
    WHERE r.ciclo_digital_id IS NULL
      AND EXISTS (SELECT 1 FROM trabalhos t WHERE t.remessa_id=r.id AND t.excluido=0)
  `).first();
  return Number(item?.total || 0);
}
