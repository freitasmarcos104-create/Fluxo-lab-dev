// FLUXO LAB V5.4.0 — SERVIÇO DE COMUNICAÇÃO E CONVERSAS
// Consultas de chat de trabalho, chat da equipe digital e conversas privadas.
// SQL e regras de acesso preservados; dependências de política são injetadas.

export async function listarChatServiceV54(
  env,
  trabalhoId
) {

  const resultado =
    await env.db.prepare(`

      SELECT

        c.*,

        u.nome
          AS autor,

        u.setor,

        ur.nome
          AS resolvedor

      FROM chat_trabalho c

      INNER JOIN usuarios u
        ON u.id =
           c.usuario_id

      LEFT JOIN usuarios ur
        ON ur.id =
           c.resolvido_por

      WHERE
        c.trabalho_id = ?

      ORDER BY
        c.id ASC

      LIMIT 300

    `)
    .bind(
      trabalhoId
    )
    .all();

  return (
    resultado.results
    ||
    []
  );
}

export async function existeConversaPrivadaServiceV54(
  env,
  usuarioA,
  usuarioB
) {

  const resultado =
    await env.db.prepare(`

      SELECT
        id

      FROM mensagens_privadas

      WHERE
        (
          remetente_id = ?
          AND destinatario_id = ?
        )

        OR

        (
          remetente_id = ?
          AND destinatario_id = ?
        )

      LIMIT 1

    `)
    .bind(
      usuarioA,
      usuarioB,
      usuarioB,
      usuarioA
    )
    .first();

  return Boolean(
    resultado
  );
}

export async function podeConversarPrivadoServiceV54(
  env,
  usuario,
  alvo,
  deps
) {
  const { perfilGestaoMensagens, isGerencia, areaGerenciaV31, areasUsuarioV31 } = deps;

  if (
    !usuario

    ||

    !alvo

    ||

    Number(
      usuario.id
    )
    ===
    Number(
      alvo.id
    )
  ) {
    return false;
  }

  if (
    perfilGestaoMensagens(usuario.perfil)
    && alvo.perfil === "FUNCIONARIO"
    && alvo.ativo
    && !alvo.excluido
  ) {
    if (isGerencia(usuario)) {
      const area = areaGerenciaV31(usuario);
      if (!area) return false;
      const vinculo = await env.db.prepare(`
        SELECT 1
        FROM usuario_areas
        WHERE usuario_id = ? AND area = ? AND ativo = 1
        LIMIT 1
      `).bind(alvo.id, area).first();
      return Boolean(vinculo);
    }
    return true;
  }

  if (
    usuario.perfil === "FUNCIONARIO"
    && perfilGestaoMensagens(alvo.perfil)
    && alvo.ativo
    && !alvo.excluido
  ) {
    // V3.4.20: funcionário pode iniciar conversa com ADM/Coordenação.
    if (["ADMINISTRADOR", "COORDENADOR"].includes(alvo.perfil)) return true;
    // Gerência somente quando compartilha pelo menos uma área com o funcionário.
    const areasFuncionario = areasUsuarioV31(usuario);
    if (!areasFuncionario.length) return false;
    const vinculo = await env.db.prepare(`
      SELECT 1
      FROM usuario_areas
      WHERE usuario_id = ?
        AND ativo = 1
        AND area IN (${areasFuncionario.map(() => "?").join(",")})
      LIMIT 1
    `).bind(alvo.id, ...areasFuncionario).first();
    return Boolean(vinculo);
  }

  return false;
}

export async function listarConversaPrivadaServiceV54(
  env,
  usuarioId,
  alvoId
) {

  const resultado =
    await env.db.prepare(`

      SELECT

        id,
        remetente_id,
        destinatario_id,
        mensagem,
        lido,
        criado_em

      FROM mensagens_privadas

      WHERE
        (
          remetente_id = ?
          AND destinatario_id = ?
        )

        OR

        (
          remetente_id = ?
          AND destinatario_id = ?
        )

      ORDER BY
        id ASC

      LIMIT 500

    `)
    .bind(
      usuarioId,
      alvoId,
      alvoId,
      usuarioId
    )
    .all();

  return (
    resultado.results
    ||
    []
  );
}

export async function marcarConversaComoLidaServiceV54(
  env,
  usuarioId,
  alvoId
) {

  await env.db.prepare(`

    UPDATE mensagens_privadas

    SET
      lido = 1

    WHERE
      remetente_id = ?

      AND destinatario_id = ?

      AND lido = 0

  `)
  .bind(
    alvoId,
    usuarioId
  )
  .run();
}

export async function limparChatEquipeDigitalV3420ServiceV54(env) {
  if (!env?.db) return;
  try {
    await env.db.prepare(`
      DELETE FROM chat_equipe_digital
      WHERE expira_em <= ?
        AND COALESCE(favorita, 0) = 0
    `).bind(new Date().toISOString()).run();
  } catch (erro) {
    // Deploy pode anteceder a migração. Não derruba o Worker; a rota do chat avisa sobre a migração.
    if (!/no such table/i.test(String(erro?.message || erro))) throw erro;
  }
}

export async function listarChatEquipeDigitalV3420ServiceV54(env) {
  const agora = new Date().toISOString();
  const resultado = await env.db.prepare(`
    SELECT
      c.id,
      c.autor_id,
      c.mensagem,
      c.criado_em,
      c.expira_em,
      COALESCE(c.favorita, 0) AS favorita,
      (SELECT p.avatar FROM usuario_perfil_v38 p WHERE p.usuario_id = c.autor_id) AS avatar,
      (SELECT CASE WHEN p.foto IS NULL OR p.foto = '' THEN 0 ELSE 1 END FROM usuario_perfil_v38 p WHERE p.usuario_id = c.autor_id) AS tem_foto,
      u.nome,
      u.perfil,
      COALESCE((
        SELECT GROUP_CONCAT(us.setor, '|')
        FROM usuario_setores us
        WHERE us.usuario_id = u.id
          AND us.area = 'DIGITAL'
          AND us.ativo = 1
      ), '') AS setores_digitais
    FROM chat_equipe_digital c
    INNER JOIN usuarios u ON u.id = c.autor_id
    WHERE c.expira_em > ? OR COALESCE(c.favorita, 0) = 1
    ORDER BY c.id ASC
    LIMIT 300
  `).bind(agora).all();
  return resultado.results || [];
}
