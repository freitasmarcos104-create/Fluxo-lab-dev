// FLUXO LAB V4.5.0 — CONSULTAS DE DESIGNAÇÃO DIGITAL
// Leitura de funcionários, remessas e trabalhos para a tela de designação.
// As operações que atribuem, removem ou redesignam permanecem no legado.

export async function listarFuncionariosSetorDigitalV322DomainV45(env, setor) {
  const resultado = await env.db.prepare(`
    SELECT DISTINCT u.id, u.nome, u.usuario
    FROM usuarios u
    INNER JOIN usuario_areas ua
      ON ua.usuario_id = u.id
     AND ua.area = 'DIGITAL'
     AND ua.ativo = 1
    INNER JOIN usuario_setores us
      ON us.usuario_id = u.id
     AND us.area = 'DIGITAL'
     AND us.setor = ?
     AND us.ativo = 1
    WHERE u.perfil = 'FUNCIONARIO'
      AND u.ativo = 1
      AND u.excluido = 0
    ORDER BY u.nome COLLATE NOCASE
  `).bind(setor).all();
  return resultado.results || [];
}

export async function listarRemessasDesignacaoDigitalV322DomainV45(env, cicloId) {
  if (!cicloId) return [];
  const resultado = await env.db.prepare(`
    SELECT id, municipio, numero, data_prevista_entrega, data_entrega_real
    FROM remessas
    WHERE ciclo_digital_id = ?
    ORDER BY date(data_prevista_entrega), municipio COLLATE NOCASE, numero
  `).bind(cicloId).all();
  return resultado.results || [];
}

export async function listarTrabalhosDesignacaoDigitalV322DomainV45(env, setor, cicloId, remessaId = 0, busca = "", deps = {}) {
  if (!deps.setorDigitalValidoV322(setor) || !cicloId) return [];
  const termo = `%${String(busca || "").trim().toLowerCase()}%`;
  const filtroRemessa = Number(remessaId || 0) ? "AND t.remessa_id = ?" : "";
  const filtroBusca = String(busca || "").trim() ? `
    AND (
      lower(t.paciente) LIKE ?
      OR lower(t.codigo) LIKE ?
      OR lower(t.municipio) LIKE ?
    )
  ` : "";
  const args = [setor, setor, setor, setor, setor, setor, cicloId];
  if (Number(remessaId || 0)) args.push(Number(remessaId));
  if (String(busca || "").trim()) args.push(termo, termo, termo);

  const resultado = await env.db.prepare(`
    SELECT
      t.id, t.codigo, t.paciente, t.municipio, t.superior_tipo, t.inferior_tipo,
      t.remessa_id, r.numero AS remessa_numero, r.data_prevista_entrega,
      SUM(CASE WHEN e.setor=? AND e.status='AGUARDANDO' THEN 1 ELSE 0 END) AS aguardando,
      SUM(CASE WHEN e.setor=? AND e.status='AGUARDANDO' AND e.recebido_em IS NOT NULL THEN 1 ELSE 0 END) AS disponiveis,
      SUM(CASE WHEN e.setor=? AND e.status='EM_ANDAMENTO' THEN 1 ELSE 0 END) AS andamento,
      SUM(CASE WHEN e.setor=? AND e.status='CONCLUIDO' THEN 1 ELSE 0 END) AS concluidas,
      GROUP_CONCAT(DISTINCT CASE WHEN e.setor=? AND e.status IN ('AGUARDANDO','EM_ANDAMENTO') AND e.responsavel_id IS NOT NULL THEN ur.nome END) AS responsaveis,
      GROUP_CONCAT(DISTINCT CASE WHEN e.setor=? AND e.status IN ('AGUARDANDO','EM_ANDAMENTO') AND e.responsavel_id IS NOT NULL THEN CAST(e.responsavel_id AS TEXT) END) AS responsavel_ids
    FROM trabalhos t
    INNER JOIN remessas r ON r.id=t.remessa_id
    LEFT JOIN etapas e ON e.trabalho_id=t.id
    LEFT JOIN usuarios ur ON ur.id=e.responsavel_id
    WHERE t.excluido=0
      AND t.entregue=0
      AND r.ciclo_digital_id=?
      ${filtroRemessa}
      ${filtroBusca}
    GROUP BY t.id
    HAVING aguardando > 0 OR andamento > 0
    ORDER BY date(r.data_prevista_entrega), r.municipio COLLATE NOCASE, r.numero, t.paciente COLLATE NOCASE
    LIMIT 500
  `).bind(...args).all();

  return (resultado.results || []).map(item => ({
    ...item,
    pode_designar: Number(item.aguardando || 0) > 0,
    pode_redesignar: Number(item.aguardando || 0) > 0 && Number(item.andamento || 0) === 0
  }));
}
