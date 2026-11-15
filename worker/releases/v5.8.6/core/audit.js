// FLUXO LAB V4.2.0 — CORE AUDIT
// Operações de auditoria e histórico extraídas da V4.1.0.
// Mantém SQL, parâmetros, retorno, limites e tratamento de erro originais.
// Não cria tabelas, não altera o esquema D1 e não muda regras de negócio.

export async function registrarAuditoria(
  env,
  autorId,
  alvoId,
  acao,
  detalhes
) {

  await env.db.prepare(`

    INSERT INTO auditoria_acessos (

      autor_id,
      alvo_id,
      acao,
      detalhes,
      criado_em

    )

    VALUES (
      ?,
      ?,
      ?,
      ?,
      ?
    )

  `)
    .bind(
      autorId,
      alvoId,
      acao,
      detalhes,
      new Date()
        .toISOString()
    )
    .run();
}
export async function registrarHistorico(
  env,
  trabalhoId,
  usuarioId,
  acao,
  detalhes
) {

  await env.db.prepare(`

    INSERT INTO historico (

      trabalho_id,
      usuario_id,
      acao,
      detalhes,
      criado_em

    )

    VALUES (
      ?,
      ?,
      ?,
      ?,
      ?
    )

  `)
    .bind(
      trabalhoId,
      usuarioId,
      acao,
      detalhes,
      new Date()
        .toISOString()
    )
    .run();
}
export async function registrarAuditoriaConvencional(
  env,
  trabalhoId,
  pecaId,
  etapaId,
  acao,
  setor,
  valorAnterior,
  valorNovo,
  motivo,
  usuarioId
) {
  await env.db.prepare(`
    INSERT INTO auditoria_convencional (
      trabalho_id,
      peca_id,
      etapa_id,
      acao,
      setor,
      valor_anterior,
      valor_novo,
      motivo,
      realizado_por,
      criado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    trabalhoId,
    pecaId || null,
    etapaId || null,
    acao,
    setor || null,
    valorAnterior || null,
    valorNovo || null,
    motivo || null,
    usuarioId,
    new Date().toISOString()
  ).run();
}
export async function listarAuditoriaConvencional(env, trabalhoId) {
  const resultado = await env.db.prepare(`
    SELECT
      a.*,
      u.nome AS realizado_por_nome,
      p.arcada
    FROM auditoria_convencional a
    LEFT JOIN usuarios u ON u.id = a.realizado_por
    LEFT JOIN pecas_convencionais p ON p.id = a.peca_id
    WHERE a.trabalho_id = ?
    ORDER BY a.id DESC
    LIMIT 60
  `).bind(trabalhoId).all();
  return resultado.results || [];
}
export async function registrarAuditoriaSistemaV31(
  env,
  usuarioId,
  area,
  acao,
  entidade,
  registroId = null,
  campo = null,
  valorAnterior = null,
  valorNovo = null,
  motivo = null
) {
  try {
    await env.db.prepare(`
      INSERT INTO auditoria_sistema_v31 (
        area, usuario_id, acao, entidade, registro_id, campo,
        valor_anterior, valor_novo, motivo, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      ["DIGITAL", "CONVENCIONAL"].includes(area) ? area : "GERAL",
      usuarioId,
      String(acao || "ACAO"),
      String(entidade || "SISTEMA"),
      registroId === null || registroId === undefined ? null : String(registroId),
      campo || null,
      valorAnterior === null || valorAnterior === undefined ? null : String(valorAnterior),
      valorNovo === null || valorNovo === undefined ? null : String(valorNovo),
      motivo || null,
      new Date().toISOString()
    ).run();
    return true;
  } catch (erro) {
    console.log("Auditoria V3.4.4:", erro?.message || erro);
    try {
      await env.db.prepare(`INSERT INTO avisos_coordenador (remetente_id,trabalho_id,mensagem,urgente,lido,criado_em,encerrado) VALUES (?,NULL,?,1,0,?,0)`).bind(
        usuarioId || null,
        `Falha de auditoria: ${String(acao||"ACAO")} em ${String(entidade||"SISTEMA")}${registroId!==null&&registroId!==undefined?` #${registroId}`:""}. Verifique os logs antes de novas alterações.`,
        new Date().toISOString()
      ).run();
    } catch (_) { }
    return false;
  }
}
export async function listarAuditoriaSistemaV31(env, limite=250) {
  const resultado=await env.db.prepare(`
    SELECT a.*,u.nome AS usuario_nome FROM auditoria_sistema_v31 a
    LEFT JOIN usuarios u ON u.id=a.usuario_id
    ORDER BY a.id DESC LIMIT ?
  `).bind(Math.min(500,Math.max(20,Number(limite)||250))).all();
  return resultado.results||[];
}
