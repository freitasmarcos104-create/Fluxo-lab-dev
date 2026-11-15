// FLUXO LAB V4.3.0 — DOMÍNIO DA PRODUÇÃO DIGITAL
// Camada inicial de consultas ao D1 para trabalhos, remessas, etapas, componentes e retrabalhos.
// As funções foram extraídas sem alterar SQL, parâmetros, filtros ou formato de retorno.
// Este módulo não cria tabelas nem executa migrações.

export async function obterTrabalho(
  env,
  id
) {

  return await env.db.prepare(`

    SELECT

      t.*,

      u.nome
        AS criador,

      ue.nome
        AS entrega_por,

      r.numero
        AS remessa_numero,

      r.data_recebimento
        AS remessa_data_recebimento,

      r.data_prevista_entrega
        AS remessa_data_prevista_entrega

    FROM trabalhos t

    LEFT JOIN usuarios u
      ON u.id =
         t.criado_por

    LEFT JOIN usuarios ue
      ON ue.id =
         t.entrega_registrada_por

    LEFT JOIN remessas r
      ON r.id =
         t.remessa_id

    WHERE
      t.id = ?

      AND t.excluido = 0

    LIMIT 1

  `)
    .bind(id)
    .first();
}
export async function listarEtapas(
  env,
  trabalhoId
) {

  const resultado =
    await env.db.prepare(`

      SELECT

        e.*,

        u.nome
          AS responsavel,

        ud.nome
          AS designador,

        (

          SELECT
            COUNT(*)

          FROM retrabalhos r

          WHERE
            r.etapa_id =
              e.id

        )
        AS total_retrabalhos

      FROM etapas e

      LEFT JOIN usuarios u
        ON u.id =
           e.responsavel_id

      LEFT JOIN usuarios ud
        ON ud.id =
           e.designado_por

      WHERE
        e.trabalho_id = ?

      ORDER BY

        CASE e.arcada

          WHEN 'SUPERIOR'
          THEN 1

          ELSE 2

        END,

        CASE e.setor

          WHEN 'CAD/CAM'
          THEN 1

          WHEN 'FATIAMENTO'
          THEN 2

          WHEN 'IMPRESSAO'
          THEN 3

          WHEN 'ACABAMENTO'
          THEN 4

          ELSE 9

        END

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
export async function listarComponentes(
  env,
  trabalhoId
) {

  const resultado =
    await env.db.prepare(`

      SELECT

        c.*,

        u.nome
          AS responsavel,

        ud.nome
          AS designador,

        (

          SELECT
            COUNT(*)

          FROM retrabalhos r

          WHERE
            r.componente_id =
              c.id

        )
        AS total_retrabalhos

      FROM componentes_impressao c

      LEFT JOIN usuarios u
        ON u.id =
           c.responsavel_id

      LEFT JOIN usuarios ud
        ON ud.id =
           c.designado_por

      WHERE
        c.trabalho_id = ?

      ORDER BY

        CASE c.arcada

          WHEN 'SUPERIOR'
          THEN 1

          ELSE 2

        END,

        CASE c.componente

          WHEN 'BASE'
          THEN 1

          WHEN 'DENTES'
          THEN 2

          WHEN 'GENGIVA'
          THEN 3

          WHEN 'PPR_FLEX'
          THEN 4

          ELSE 9

        END

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
export async function listarRetrabalhos(
  env,
  trabalhoId
) {

  const resultado =
    await env.db.prepare(`

      SELECT

        r.*,

        ur.nome
          AS registrador,

        ue.nome
          AS executor

      FROM retrabalhos r

      LEFT JOIN usuarios ur
        ON ur.id =
           r.registrado_por

      LEFT JOIN usuarios ue
        ON ue.id =
           r.executado_por

      WHERE
        r.trabalho_id = ?

      ORDER BY
        r.id DESC

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
export async function obterRemessa(
  env,
  id
) {

  return await env.db.prepare(`

    SELECT *

    FROM remessas

    WHERE id = ?

    LIMIT 1

  `)
  .bind(id)
  .first();
}
export async function obterEtapa(
  env,
  id
) {
  return await env.db.prepare(`

    SELECT *

    FROM etapas

    WHERE id = ?

    LIMIT 1

  `)
    .bind(id)
    .first();
}
export async function obterComponente(
  env,
  id
) {
  return await env.db.prepare(`

    SELECT *

    FROM componentes_impressao

    WHERE id = ?

    LIMIT 1

  `)
    .bind(id)
    .first();
}
export async function obterRetrabalho(
  env,
  id
) {
  return await env.db.prepare(`

    SELECT *

    FROM retrabalhos

    WHERE id = ?

    LIMIT 1

  `)
    .bind(id)
    .first();
}
