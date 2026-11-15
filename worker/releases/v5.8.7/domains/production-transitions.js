// FLUXO LAB V4.4.0 — TRANSIÇÕES DA PRODUÇÃO DIGITAL
// Regras de início e conclusão de etapas e componentes de impressão.
// Dependências de domínio são injetadas pelo legado para preservar compatibilidade.
// SQL, validações, permissões, histórico e parâmetros originais foram preservados.

export async function iniciarEtapaDomainV44(
  env,
  etapa,
  usuario
, deps) {

  if (
    etapa.setor ===
    "IMPRESSAO"
  ) {
    throw new Error(
      "A Impressão é controlada pelos componentes."
    );
  }

  if (
    !deps.podeOperarEtapa(
      usuario,
      etapa.setor
    )
  ) {
    throw new Error(
      "Você não possui permissão para iniciar esta etapa."
    );
  }

  if (
    usuario?.perfil === "FUNCIONARIO"
    && etapa.responsavel_id
    && Number(etapa.responsavel_id) !== Number(usuario.id)
  ) {
    throw new Error(
      "Esta etapa foi designada para outro funcionário."
    );
  }

  if (
    etapa.status !==
      "AGUARDANDO"

    ||

    !etapa.recebido_em
  ) {
    throw new Error(
      "Esta etapa ainda não está disponível."
    );
  }

  const agora =
    new Date()
      .toISOString();

  await env.db.prepare(`

    UPDATE etapas

    SET
      status =
        'EM_ANDAMENTO',

      responsavel_id = ?,

      iniciado_em = ?,

      designado_por = CASE
        WHEN designado_por IS NOT NULL AND responsavel_id IS NOT NULL AND responsavel_id != ? THEN ?
        ELSE designado_por
      END,

      designado_em = CASE
        WHEN designado_por IS NOT NULL AND responsavel_id IS NOT NULL AND responsavel_id != ? THEN ?
        ELSE designado_em
      END

    WHERE
      id = ?

      AND status =
        'AGUARDANDO'

  `)
    .bind(
      usuario.id,
      agora,
      usuario.id,
      usuario.id,
      usuario.id,
      agora,
      etapa.id
    )
    .run();

  await deps.registrarHistorico(
    env,
    etapa.trabalho_id,
    usuario.id,
    "ETAPA_INICIADA",
    `${etapa.setor} iniciado para ${etapa.arcada}.`
  );
}
export async function concluirEtapaDomainV44(
  env,
  etapa,
  usuario
, deps) {

  if (
    etapa.setor ===
    "IMPRESSAO"
  ) {
    throw new Error(
      "A Impressão é concluída pelos componentes."
    );
  }

  if (
    !deps.podeOperarEtapa(
      usuario,
      etapa.setor
    )
  ) {
    throw new Error(
      "Sem permissão."
    );
  }

  if (
    etapa.status !==
      "EM_ANDAMENTO"

    ||

    Number(
      etapa.responsavel_id
    )
    !==
    Number(
      usuario.id
    )
  ) {
    throw new Error(
      "Etapa não está vinculada a você."
    );
  }

  const agora =
    new Date()
      .toISOString();

  await env.db.prepare(`

    UPDATE etapas

    SET
      status =
        'CONCLUIDO',

      concluido_em = ?

    WHERE id = ?

  `)
    .bind(
      agora,
      etapa.id
    )
    .run();

  await deps.registrarHistorico(
    env,
    etapa.trabalho_id,
    usuario.id,
    "ETAPA_CONCLUIDA",
    `${etapa.setor} concluído para ${etapa.arcada}.`
  );

  const proximo =
    deps.SETORES[
      deps.SETORES.indexOf(
        etapa.setor
      )
      +
      1
    ];

  if (
    proximo
  ) {

    await env.db.prepare(`

      UPDATE etapas

      SET
        recebido_em =
          COALESCE(
            recebido_em,
            ?
          )

      WHERE
        trabalho_id = ?

        AND arcada = ?

        AND setor = ?

    `)
      .bind(
        agora,
        etapa.trabalho_id,
        etapa.arcada,
        proximo
      )
      .run();

    if (
      proximo ===
      "IMPRESSAO"
    ) {

      await env.db.prepare(`

        UPDATE componentes_impressao

        SET
          recebido_em =
            COALESCE(
              recebido_em,
              ?
            )

        WHERE
          trabalho_id = ?

          AND arcada = ?

      `)
        .bind(
          agora,
          etapa.trabalho_id,
          etapa.arcada
        )
        .run();
    }
  }
}


/* =========================================================
   COMPONENTES
========================================================= */
export async function iniciarComponenteDomainV44(
  env,
  componente,
  usuario
, deps) {

  if (
    !deps.podeOperarEtapa(
      usuario,
      "IMPRESSAO"
    )
  ) {
    throw new Error(
      "Sem permissão."
    );
  }

  if (
    usuario?.perfil === "FUNCIONARIO"
    && componente.responsavel_id
    && Number(componente.responsavel_id) !== Number(usuario.id)
  ) {
    throw new Error(
      "Este componente foi designado para outro funcionário."
    );
  }

  if (
    componente.status !==
      "AGUARDANDO"

    ||

    !componente.recebido_em
  ) {
    throw new Error(
      "Componente indisponível."
    );
  }

  const agora =
    new Date()
      .toISOString();

  await env.db.prepare(`

    UPDATE componentes_impressao

    SET
      status =
        'EM_ANDAMENTO',

      responsavel_id = ?,

      iniciado_em = ?,

      designado_por = CASE
        WHEN designado_por IS NOT NULL AND responsavel_id IS NOT NULL AND responsavel_id != ? THEN ?
        ELSE designado_por
      END,

      designado_em = CASE
        WHEN designado_por IS NOT NULL AND responsavel_id IS NOT NULL AND responsavel_id != ? THEN ?
        ELSE designado_em
      END

    WHERE
      id = ?

      AND status =
        'AGUARDANDO'

  `)
    .bind(
      usuario.id,
      agora,
      usuario.id,
      usuario.id,
      usuario.id,
      agora,
      componente.id
    )
    .run();

  await env.db.prepare(`

    UPDATE etapas

    SET

      status =

        CASE

          WHEN
            status =
            'CONCLUIDO'

          THEN
            status

          ELSE
            'EM_ANDAMENTO'

        END,

      iniciado_em =
        COALESCE(
          iniciado_em,
          ?
        )

    WHERE
      trabalho_id = ?

      AND arcada = ?

      AND setor =
        'IMPRESSAO'

  `)
    .bind(
      agora,
      componente.trabalho_id,
      componente.arcada
    )
    .run();

  await deps.registrarHistorico(
    env,
    componente.trabalho_id,
    usuario.id,
    "COMPONENTE_INICIADO",
    `${deps.nomeComponente(
      componente.componente
    )} iniciado na Impressão (${componente.arcada}).`
  );
}
export async function concluirComponenteDomainV44(
  env,
  componente,
  usuario
, deps) {

  if (
    !deps.podeOperarEtapa(
      usuario,
      "IMPRESSAO"
    )
  ) {
    throw new Error(
      "Sem permissão."
    );
  }

  if (
    componente.status !==
      "EM_ANDAMENTO"

    ||

    Number(
      componente.responsavel_id
    )
    !==
    Number(
      usuario.id
    )
  ) {
    throw new Error(
      "Componente não está vinculado a você."
    );
  }

  const agora =
    new Date()
      .toISOString();

  await env.db.prepare(`

    UPDATE componentes_impressao

    SET
      status =
        'CONCLUIDO',

      concluido_em = ?

    WHERE id = ?

  `)
    .bind(
      agora,
      componente.id
    )
    .run();

  await deps.registrarHistorico(
    env,
    componente.trabalho_id,
    usuario.id,
    "COMPONENTE_CONCLUIDO",
    `${deps.nomeComponente(
      componente.componente
    )} concluído na Impressão (${componente.arcada}).`
  );

  const faltam =
    await env.db.prepare(`

      SELECT
        COUNT(*) AS total

      FROM componentes_impressao

      WHERE
        trabalho_id = ?

        AND arcada = ?

        AND status !=
          'CONCLUIDO'

    `)
      .bind(
        componente.trabalho_id,
        componente.arcada
      )
      .first();

  if (
    Number(
      faltam.total
    )
    ===
    0
  ) {

    await env.db.prepare(`

      UPDATE etapas

      SET
        status =
          'CONCLUIDO',

        concluido_em = ?

      WHERE
        trabalho_id = ?

        AND arcada = ?

        AND setor =
          'IMPRESSAO'

    `)
      .bind(
        agora,
        componente.trabalho_id,
        componente.arcada
      )
      .run();

    await env.db.prepare(`

      UPDATE etapas

      SET
        recebido_em =
          COALESCE(
            recebido_em,
            ?
          )

      WHERE
        trabalho_id = ?

        AND arcada = ?

        AND setor =
          'ACABAMENTO'

    `)
      .bind(
        agora,
        componente.trabalho_id,
        componente.arcada
      )
      .run();
  }
}


/* =========================================================
   RETRABALHOS
========================================================= */
