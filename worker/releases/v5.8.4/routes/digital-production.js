// FLUXO LAB V4.8.0 — ROTAS OPERACIONAIS DA PRODUÇÃO DIGITAL
// Início/conclusão de etapas e componentes, correções administrativas e retrabalhos.
// Bloco original movido do fetch, sem alteração de caminhos, mensagens ou regras.

export async function handleDigitalProductionRoutesV48(request, env, url, caminho, deps) {
  const { isAdmin, isCoord, obterComponente, obterEtapa, obterRetrabalho, obterUsuarioLogado, operarProducaoV336, redirect, registrarAuditoriaSistemaV31, registrarHistorico, registrarRetrabalho, textResponse, trabalhoDigitalAtivoV344, versaoProducaoV336 } = deps;
  let match;

      /* ETAPAS */

      match =
        caminho.match(
          /^\/etapas\/(\d+)\/responsavel-projeto$/
        );

      if (
        match
        &&
        request.method === "POST"
      ) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!isAdmin(usuario)) {
          return textResponse("Apenas o Administrador pode corrigir o responsável de um projeto já concluído.", 403);
        }

        const etapaId = Number(match[1]);
        const etapa = await obterEtapa(env, etapaId);
        if (!etapa) return textResponse("Etapa não encontrada.", 404);

        if (etapa.setor !== "CAD/CAM" || etapa.status !== "CONCLUIDO" || !etapa.concluido_em) {
          return redirect(
            `/trabalhos/${etapa.trabalho_id}?erro=`
            + encodeURIComponent("A correção de responsável está disponível somente para projetos CAD/CAM já concluídos.")
          );
        }

        const form = await request.formData();
        const responsavelId = Number(form.get("responsavel_id") || 0);
        const motivo = String(form.get("motivo") || "").trim().slice(0, 250);
        if (!Number.isSafeInteger(responsavelId) || responsavelId < 1) {
          return redirect(`/trabalhos/${etapa.trabalho_id}?erro=${encodeURIComponent("Selecione um responsável válido.")}`);
        }

        const novoResponsavel = await env.db.prepare(`
          SELECT u.id, u.nome
          FROM usuarios u
          WHERE u.id = ?
            AND u.perfil = 'FUNCIONARIO'
            AND u.ativo = 1
            AND u.excluido = 0
            AND EXISTS (
              SELECT 1 FROM usuario_areas ua
              WHERE ua.usuario_id = u.id
                AND ua.area = 'DIGITAL'
                AND ua.ativo = 1
            )
            AND EXISTS (
              SELECT 1 FROM usuario_setores us
              WHERE us.usuario_id = u.id
                AND us.area = 'DIGITAL'
                AND us.setor = 'CAD/CAM'
                AND us.ativo = 1
            )
          LIMIT 1
        `).bind(responsavelId).first();

        if (!novoResponsavel) {
          return redirect(
            `/trabalhos/${etapa.trabalho_id}?erro=`
            + encodeURIComponent("O responsável selecionado não está ativo no setor CAD/CAM.")
          );
        }

        const antigoId = etapa.responsavel_id === null || etapa.responsavel_id === undefined
          ? null
          : Number(etapa.responsavel_id);

        if (antigoId === Number(novoResponsavel.id)) {
          return redirect(
            `/trabalhos/${etapa.trabalho_id}?ok=`
            + encodeURIComponent("O responsável selecionado já é o responsável registrado neste projeto.")
          );
        }

        const antigoUsuario = antigoId
          ? await env.db.prepare(`SELECT nome FROM usuarios WHERE id = ? LIMIT 1`).bind(antigoId).first()
          : null;
        const antigoNome = antigoUsuario?.nome || etapa.responsavel || "—";

        const alteracao = await env.db.prepare(`
          UPDATE etapas
          SET responsavel_id = ?
          WHERE id = ?
            AND setor = 'CAD/CAM'
            AND status = 'CONCLUIDO'
            AND responsavel_id IS ?
        `).bind(novoResponsavel.id, etapa.id, antigoId).run();

        if (Number(alteracao.meta?.changes || 0) !== 1) {
          return redirect(
            `/trabalhos/${etapa.trabalho_id}?erro=`
            + encodeURIComponent("O projeto mudou enquanto a correção era feita. Atualize a página e tente novamente.")
          );
        }

        const detalheHistorico = `Responsável do projeto CAD/CAM concluído corrigido: ${antigoNome} → ${novoResponsavel.nome}. Arcada: ${etapa.arcada || "—"}.${motivo ? ` Motivo: ${motivo}` : ""}`;
        await registrarHistorico(
          env,
          etapa.trabalho_id,
          usuario.id,
          "RESPONSAVEL_PROJETO_CORRIGIDO",
          detalheHistorico
        );

        await registrarAuditoriaSistemaV31(
          env,
          usuario.id,
          "DIGITAL",
          "ALTERAR_RESPONSAVEL_PROJETO_CONCLUIDO",
          "ETAPA",
          etapa.id,
          "responsavel_id",
          antigoId,
          novoResponsavel.id,
          motivo || null
        );

        return redirect(
          `/trabalhos/${etapa.trabalho_id}?ok=`
          + encodeURIComponent(`Responsável do projeto corrigido de ${antigoNome} para ${novoResponsavel.nome}.`)
        );
      }

      match =
        caminho.match(
          /^\/etapas\/(\d+)\/desfazer-conclusao-acabamento$/
        );

      if (
        match
        &&
        request.method === "POST"
      ) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!isCoord(usuario)) {
          return textResponse("Somente Administrador/Coordenador pode desfazer uma conclusão de Acabamento.", 403);
        }

        const etapaId = Number(match[1]);
        const etapa = await obterEtapa(env, etapaId);
        if (!etapa) return textResponse("Etapa não encontrada.", 404);

        if (etapa.setor !== "ACABAMENTO" || etapa.status !== "CONCLUIDO" || !etapa.concluido_em) {
          return redirect(
            `/trabalhos/${etapa.trabalho_id}?erro=`
            + encodeURIComponent("Somente um Acabamento concluído pode ter a conclusão desfeita.")
          );
        }

        const trabalhoAtivo = await trabalhoDigitalAtivoV344(env, etapa.trabalho_id);
        if (!trabalhoAtivo) {
          return redirect(
            `/trabalhos/${etapa.trabalho_id}?erro=`
            + encodeURIComponent("Não é possível alterar um trabalho entregue, arquivado ou excluído.")
          );
        }

        const form = await request.formData();
        const motivo = String(form.get("motivo") || "").trim().slice(0, 250);
        if (motivo.length < 5) {
          return redirect(
            `/trabalhos/${etapa.trabalho_id}?erro=`
            + encodeURIComponent("Informe o motivo da correção com pelo menos 5 caracteres.")
          );
        }

        const retrabalhoAtivo = await env.db.prepare(`
          SELECT COUNT(*) AS total
          FROM retrabalhos
          WHERE trabalho_id = ?
            AND setor = 'ACABAMENTO'
            AND arcada = ?
            AND status IN ('AGUARDANDO','EM_ANDAMENTO')
        `).bind(etapa.trabalho_id, etapa.arcada).first();

        if (Number(retrabalhoAtivo?.total || 0) > 0) {
          return redirect(
            `/trabalhos/${etapa.trabalho_id}?erro=`
            + encodeURIComponent("Existe retrabalho ativo neste Acabamento. Resolva o retrabalho antes de desfazer a conclusão.")
          );
        }

        const conclusaoAnterior = String(etapa.concluido_em);
        const alteracao = await env.db.prepare(`
          UPDATE etapas
          SET status = 'EM_ANDAMENTO',
              concluido_em = NULL
          WHERE id = ?
            AND setor = 'ACABAMENTO'
            AND status = 'CONCLUIDO'
            AND concluido_em = ?
        `).bind(etapa.id, conclusaoAnterior).run();

        if (Number(alteracao.meta?.changes || 0) !== 1) {
          return redirect(
            `/trabalhos/${etapa.trabalho_id}?erro=`
            + encodeURIComponent("A etapa mudou enquanto a correção era feita. Atualize a página e tente novamente.")
          );
        }

        const detalhe = `Conclusão do Acabamento desfeita por correção administrativa. Arcada: ${etapa.arcada || "—"}. Conclusão anterior: ${conclusaoAnterior}. Motivo: ${motivo}`;
        await registrarHistorico(
          env,
          etapa.trabalho_id,
          usuario.id,
          "CONCLUSAO_ACABAMENTO_DESFEITA",
          detalhe
        );

        await registrarAuditoriaSistemaV31(
          env,
          usuario.id,
          "DIGITAL",
          "DESFAZER_CONCLUSAO_ACABAMENTO",
          "ETAPA",
          etapa.id,
          "status/concluido_em",
          `CONCLUIDO|${conclusaoAnterior}`,
          "EM_ANDAMENTO|null",
          motivo
        );

        return redirect(
          `/trabalhos/${etapa.trabalho_id}?ok=`
          + encodeURIComponent("Conclusão do Acabamento desfeita. A etapa voltou para Em andamento.")
        );
      }

      match =
        caminho.match(
          /^\/etapas\/(\d+)\/iniciar$/
        );

      if (
        match

        &&

        request.method ===
          "POST"
      ) {

        const usuario =
          await obterUsuarioLogado(
            request,
            env
          );

        if (!usuario) {
          return redirect("/");
        }

        const etapa =
          await obterEtapa(
            env,
            Number(
              match[1]
            )
          );

        if (!etapa) {

          return textResponse(
            "Etapa não encontrada.",
            404
          );
        }

        await operarProducaoV336(env, usuario, {tipo:"etapas", id:Number(etapa.id), acao:"iniciar", versao:versaoProducaoV336(etapa)});

        return redirect(

          `/trabalhos/${etapa.trabalho_id}?ok=`

          +

          encodeURIComponent(
            "Etapa iniciada."
          )
        );
      }

      match =
        caminho.match(
          /^\/etapas\/(\d+)\/concluir$/
        );

      if (
        match

        &&

        request.method ===
          "POST"
      ) {

        const usuario =
          await obterUsuarioLogado(
            request,
            env
          );

        if (!usuario) {
          return redirect("/");
        }

        const etapa =
          await obterEtapa(
            env,
            Number(
              match[1]
            )
          );

        if (!etapa) {

          return textResponse(
            "Etapa não encontrada.",
            404
          );
        }

        await operarProducaoV336(env, usuario, {tipo:"etapas", id:Number(etapa.id), acao:"concluir", versao:versaoProducaoV336(etapa)});

        return redirect(

          `/trabalhos/${etapa.trabalho_id}?ok=`

          +

          encodeURIComponent(
            "Etapa concluída."
          )
        );
      }


      /* COMPONENTES */

      match =
        caminho.match(
          /^\/componentes\/(\d+)\/iniciar$/
        );

      if (
        match

        &&

        request.method ===
          "POST"
      ) {

        const usuario =
          await obterUsuarioLogado(
            request,
            env
          );

        if (!usuario) {
          return redirect("/");
        }

        const componente =
          await obterComponente(
            env,
            Number(
              match[1]
            )
          );

        if (!componente) {

          return textResponse(
            "Componente não encontrado.",
            404
          );
        }

        await operarProducaoV336(env, usuario, {tipo:"componentes", id:Number(componente.id), acao:"iniciar", versao:versaoProducaoV336(componente)});

        return redirect(

          `/trabalhos/${componente.trabalho_id}?ok=`

          +

          encodeURIComponent(
            "Componente iniciado."
          )
        );
      }

      match =
        caminho.match(
          /^\/componentes\/(\d+)\/concluir$/
        );

      if (
        match

        &&

        request.method ===
          "POST"
      ) {

        const usuario =
          await obterUsuarioLogado(
            request,
            env
          );

        if (!usuario) {
          return redirect("/");
        }

        const componente =
          await obterComponente(
            env,
            Number(
              match[1]
            )
          );

        if (!componente) {

          return textResponse(
            "Componente não encontrado.",
            404
          );
        }

        await operarProducaoV336(env, usuario, {tipo:"componentes", id:Number(componente.id), acao:"concluir", versao:versaoProducaoV336(componente)});

        return redirect(

          `/trabalhos/${componente.trabalho_id}?ok=`

          +

          encodeURIComponent(
            "Componente concluído."
          )
        );
      }


      /* RETRABALHO */

      if (
        caminho ===
          "/retrabalhos/registrar"

        &&

        request.method ===
          "POST"
      ) {

        const usuario =
          await obterUsuarioLogado(
            request,
            env
          );

        if (!usuario) {
          return redirect("/");
        }

        const dados =
          await request.formData();

        const tipo =
          String(
            dados.get("tipo")
            ||
            ""
          );

        const id =
          Number(
            dados.get("id")
          );

        const motivo =
          String(
            dados.get("motivo")
            ||
            ""
          )
          .trim();

        if (
          motivo.length < 3
        ) {

          return textResponse(
            "Informe o motivo.",
            400
          );
        }

        const trabalhoId =
          await registrarRetrabalho(
            env,
            usuario,
            tipo,
            id,
            motivo
          );

        return redirect(

          `/trabalhos/${trabalhoId}?ok=`

          +

          encodeURIComponent(
            "Retrabalho registrado."
          )
        );
      }

      match =
        caminho.match(
          /^\/retrabalhos\/(\d+)\/iniciar$/
        );

      if (
        match

        &&

        request.method ===
          "POST"
      ) {

        const usuario =
          await obterUsuarioLogado(
            request,
            env
          );

        if (!usuario) {
          return redirect("/");
        }

        const retrabalho =
          await obterRetrabalho(
            env,
            Number(
              match[1]
            )
          );

        if (!retrabalho) {

          return textResponse(
            "Retrabalho não encontrado.",
            404
          );
        }

        await operarProducaoV336(env, usuario, {tipo:"retrabalhos", id:Number(retrabalho.id), acao:"iniciar", versao:versaoProducaoV336(retrabalho)});

        return redirect(
          `/trabalhos/${retrabalho.trabalho_id}`
        );
      }

      match =
        caminho.match(
          /^\/retrabalhos\/(\d+)\/concluir$/
        );

      if (
        match

        &&

        request.method ===
          "POST"
      ) {

        const usuario =
          await obterUsuarioLogado(
            request,
            env
          );

        if (!usuario) {
          return redirect("/");
        }

        const retrabalho =
          await obterRetrabalho(
            env,
            Number(
              match[1]
            )
          );

        if (!retrabalho) {

          return textResponse(
            "Retrabalho não encontrado.",
            404
          );
        }

        await operarProducaoV336(env, usuario, {tipo:"retrabalhos", id:Number(retrabalho.id), acao:"concluir", versao:versaoProducaoV336(retrabalho)});

        return redirect(

          `/trabalhos/${retrabalho.trabalho_id}?ok=`

          +

          encodeURIComponent(
            "Retrabalho concluído."
          )
        );
      }

  return null;
}
