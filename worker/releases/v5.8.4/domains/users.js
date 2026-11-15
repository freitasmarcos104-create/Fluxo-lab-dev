// FLUXO LAB V5.3.0 — REPOSITÓRIO D1 DE USUÁRIOS, ACESSOS E PERMISSÕES
// Consultas de usuário, listagem de funcionários/acessos e sincronização de áreas/setores.
// SQL original preservado. Sem alteração de esquema ou regras de autorização.

export async function obterUsuarioV31ServiceV53(env, id) {
  return await env.db.prepare(`
    SELECT
      u.id, u.nome, u.usuario, u.setor, u.area_producao, u.setor_convencional,
      u.perfil, u.ativo, u.excluido,
      COALESCE((
        SELECT GROUP_CONCAT(ua.area, '|')
        FROM usuario_areas ua
        WHERE ua.usuario_id = u.id AND ua.ativo = 1
      ), '') AS areas_v31,
      COALESCE((
        SELECT GROUP_CONCAT(us.area || ':' || us.setor, '|')
        FROM usuario_setores us
        WHERE us.usuario_id = u.id AND us.ativo = 1
      ), '') AS setores_v31,
      COALESCE((
        SELECT GROUP_CONCAT(ua.area || ':' || ua.participa_bonificacao, '|')
        FROM usuario_areas ua
        WHERE ua.usuario_id = u.id AND ua.ativo = 1
      ), '') AS bonus_areas_v31
    FROM usuarios u
    WHERE u.id = ? AND u.excluido = 0
    LIMIT 1
  `).bind(id).first();
}

export async function listarFuncionariosV31ServiceV53(env, area = "") {
  const areaFiltro = ["DIGITAL", "CONVENCIONAL"].includes(area) ? area : "";
  const resultado = await env.db.prepare(`
    SELECT
      u.id, u.nome, u.usuario, u.perfil, u.ativo, u.setor, u.setor_convencional, u.area_producao,
      COALESCE((
        SELECT GROUP_CONCAT(ua.area, '|') FROM usuario_areas ua
        WHERE ua.usuario_id = u.id AND ua.ativo = 1
      ), '') AS areas_v31,
      COALESCE((
        SELECT GROUP_CONCAT(us.area || ':' || us.setor, '|') FROM usuario_setores us
        WHERE us.usuario_id = u.id AND us.ativo = 1
      ), '') AS setores_v31,
      (SELECT p.avatar FROM usuario_perfil_v38 p WHERE p.usuario_id = u.id) AS avatar,
      (SELECT CASE WHEN p.foto IS NULL OR p.foto = '' THEN 0 ELSE 1 END FROM usuario_perfil_v38 p WHERE p.usuario_id = u.id) AS tem_foto
    FROM usuarios u
    WHERE u.perfil = 'FUNCIONARIO'
      AND u.excluido = 0
      AND (
        ? = '' OR EXISTS (
          SELECT 1 FROM usuario_areas ua2
          WHERE ua2.usuario_id = u.id AND ua2.area = ? AND ua2.ativo = 1
        )
      )
    ORDER BY u.ativo DESC, u.nome COLLATE NOCASE ASC
  `).bind(areaFiltro, areaFiltro).all();
  return resultado.results || [];
}

export async function sincronizarPermissoesFuncionarioV31ServiceV53(
  env,
  funcionarioId,
  setoresDigitais,
  setoresConvencionais,
  autorId
) {
  await env.db.prepare(`UPDATE usuario_areas SET ativo = 0, atualizado_em = CURRENT_TIMESTAMP WHERE usuario_id = ?`).bind(funcionarioId).run();
  await env.db.prepare(`UPDATE usuario_setores SET ativo = 0, atualizado_em = CURRENT_TIMESTAMP WHERE usuario_id = ?`).bind(funcionarioId).run();

  const areas = [];
  if (setoresDigitais.length) areas.push("DIGITAL");
  if (setoresConvencionais.length) areas.push("CONVENCIONAL");

  for (const area of areas) {
    await env.db.prepare(`
      INSERT INTO usuario_areas (usuario_id, area, ativo, participa_bonificacao, criado_por, atualizado_em)
      VALUES (?, ?, 1, 1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(usuario_id, area)
      DO UPDATE SET ativo = 1, participa_bonificacao = 1, atualizado_em = CURRENT_TIMESTAMP
    `).bind(funcionarioId, area, autorId || null).run();
  }

  for (const setor of setoresDigitais) {
    await env.db.prepare(`
      INSERT INTO usuario_setores (usuario_id, area, setor, ativo, criado_por, atualizado_em)
      VALUES (?, 'DIGITAL', ?, 1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(usuario_id, area, setor)
      DO UPDATE SET ativo = 1, atualizado_em = CURRENT_TIMESTAMP
    `).bind(funcionarioId, setor, autorId || null).run();
  }

  for (const setor of setoresConvencionais) {
    await env.db.prepare(`
      INSERT INTO usuario_setores (usuario_id, area, setor, ativo, criado_por, atualizado_em)
      VALUES (?, 'CONVENCIONAL', ?, 1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(usuario_id, area, setor)
      DO UPDATE SET ativo = 1, atualizado_em = CURRENT_TIMESTAMP
    `).bind(funcionarioId, setor, autorId || null).run();
  }
}

export async function sincronizarAreaGerenciaV31ServiceV53(env, usuarioId, area, autorId) {
  await env.db.prepare(`UPDATE usuario_areas SET ativo = 0, atualizado_em = CURRENT_TIMESTAMP WHERE usuario_id = ?`).bind(usuarioId).run();
  await env.db.prepare(`UPDATE usuario_setores SET ativo = 0, atualizado_em = CURRENT_TIMESTAMP WHERE usuario_id = ?`).bind(usuarioId).run();
  if (["DIGITAL", "CONVENCIONAL"].includes(area)) {
    await env.db.prepare(`
      INSERT INTO usuario_areas (usuario_id, area, ativo, participa_bonificacao, criado_por, atualizado_em)
      VALUES (?, ?, 1, 0, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(usuario_id, area)
      DO UPDATE SET ativo = 1, participa_bonificacao = 0, atualizado_em = CURRENT_TIMESTAMP
    `).bind(usuarioId, area, autorId || null).run();
  }
}

export async function listarAcessosV31ServiceV53(env) {
  const resultado = await env.db.prepare(`
    SELECT
      u.id, u.nome, u.usuario, u.perfil, u.ativo,
      COALESCE((SELECT GROUP_CONCAT(ua.area, '|') FROM usuario_areas ua WHERE ua.usuario_id=u.id AND ua.ativo=1),'') AS areas_v31
    FROM usuarios u
    WHERE u.perfil IN ('ADMINISTRADOR','COORDENADOR','GERENCIA','CADASTRO') AND u.excluido=0
    ORDER BY CASE u.perfil WHEN 'ADMINISTRADOR' THEN 1 WHEN 'COORDENADOR' THEN 2 WHEN 'GERENCIA' THEN 3 WHEN 'CADASTRO' THEN 4 ELSE 9 END, u.nome COLLATE NOCASE
  `).all();
  return resultado.results || [];
}
