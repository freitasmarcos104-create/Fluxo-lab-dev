// FLUXO LAB V4.8.0 — OPERAÇÕES DE RETRABALHO DIGITAL

// Funções originais transferidas do legado. Consultas, SQL, validações e histórico preservados.



export async function trabalhoDigitalAtivoV344DomainV48(env, trabalhoId) {
  return await env.db.prepare(`
    SELECT id FROM trabalhos
    WHERE id=? AND COALESCE(excluido,0)=0 AND COALESCE(arquivado,0)=0 AND COALESCE(entregue,0)=0
    LIMIT 1
  `).bind(trabalhoId).first();
}

export async function registrarRetrabalhoDomainV48(env, usuario, tipo, id, motivo, deps = {}) {

  const etapa =
    tipo === "etapa"

    ? await deps.obterEtapa(
        env,
        id
      )

    : null;

  const componente =
    tipo ===
      "componente"

    ? await deps.obterComponente(
        env,
        id
      )

    : null;

  if (
    !etapa

    &&

    !componente
  ) {
    throw new Error(
      "Etapa ou componente não encontrado."
    );
  }

  const trabalhoId =
    etapa
    ? etapa.trabalho_id
    : componente.trabalho_id;

  const arcada =
    etapa
    ? etapa.arcada
    : componente.arcada;

  if (!(await deps.trabalhoDigitalAtivoV344(env, trabalhoId))) {
    throw new Error("Trabalho encerrado, arquivado, entregue ou excluído. Retrabalho bloqueado.");
  }

  const setor =
    etapa
    ? etapa.setor
    : "IMPRESSAO";

  const status =
    etapa
    ? etapa.status
    : componente.status;

  if (
    status !==
    "CONCLUIDO"
  ) {
    throw new Error(
      "Retrabalho só pode ser registrado após a conclusão original."
    );
  }

  if (
    !(
      deps.isCoord(usuario)

      ||

      deps.podeOperarEtapa(
        usuario,
        setor
      )
    )
  ) {
    throw new Error(
      "Sem permissão para registrar retrabalho."
    );
  }

  const agora =
    new Date()
      .toISOString();

  await env.db.prepare(`

    INSERT INTO retrabalhos (

      trabalho_id,
      arcada,
      setor,
      etapa_id,
      componente_id,
      componente,
      motivo,
      status,
      registrado_por,
      executado_por,
      criado_em,
      iniciado_em,
      concluido_em

    )

    VALUES (

      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      'ABERTO',
      ?,
      NULL,
      ?,
      NULL,
      NULL

    )

  `)
    .bind(
      trabalhoId,
      arcada,
      setor,

      etapa?.id
      ||
      null,

      componente?.id
      ||
      null,

      componente?.componente
      ||
      null,

      motivo,
      usuario.id,
      agora
    )
    .run();

  await deps.registrarHistorico(
    env,
    trabalhoId,
    usuario.id,
    "RETRABALHO_REGISTRADO",
    `Retrabalho em ${setor}/${arcada}. Motivo: ${motivo}`
  );

  return trabalhoId;
}

export async function iniciarRetrabalhoDomainV48(env, retrabalho, usuario, deps = {}) {

  if (
    !(
      deps.isCoord(usuario)

      ||

      deps.podeOperarEtapa(
        usuario,
        retrabalho.setor
      )
    )
  ) {
    throw new Error(
      "Sem permissão."
    );
  }

  if (
    retrabalho.status !==
    "ABERTO"
  ) {
    throw new Error(
      "Retrabalho não está aberto."
    );
  }

  const agora =
    new Date()
      .toISOString();

  await env.db.prepare(`

    UPDATE retrabalhos

    SET
      status =
        'EM_ANDAMENTO',

      executado_por = ?,

      iniciado_em = ?

    WHERE
      id = ?

      AND status =
        'ABERTO'

  `)
    .bind(
      usuario.id,
      agora,
      retrabalho.id
    )
    .run();

  await deps.registrarHistorico(
    env,
    retrabalho.trabalho_id,
    usuario.id,
    "RETRABALHO_INICIADO",
    `Retrabalho #${retrabalho.id} iniciado.`
  );
}

export async function concluirRetrabalhoDomainV48(env, retrabalho, usuario, deps = {}) {

  if (
    !(
      deps.isCoord(usuario)

      ||

      deps.podeOperarEtapa(
        usuario,
        retrabalho.setor
      )
    )
  ) {
    throw new Error(
      "Sem permissão."
    );
  }

  if (
    retrabalho.status !==
    "EM_ANDAMENTO"
  ) {
    throw new Error(
      "Retrabalho não está em andamento."
    );
  }

  if (
    !deps.isCoord(usuario)

    &&

    Number(
      retrabalho.executado_por
    )
    !==
    Number(
      usuario.id
    )
  ) {
    throw new Error(
      "Retrabalho vinculado a outro funcionário."
    );
  }

  const agora =
    new Date()
      .toISOString();

  await env.db.prepare(`

    UPDATE retrabalhos

    SET
      status =
        'CONCLUIDO',

      concluido_em = ?

    WHERE id = ?

  `)
    .bind(
      agora,
      retrabalho.id
    )
    .run();

  await deps.registrarHistorico(
    env,
    retrabalho.trabalho_id,
    usuario.id,
    "RETRABALHO_CONCLUIDO",
    `Retrabalho #${retrabalho.id} concluído.`
  );
}
