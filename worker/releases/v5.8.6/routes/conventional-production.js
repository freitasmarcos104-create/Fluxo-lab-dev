// FLUXO LAB V4.7.0 — CONTROLADOR DA PRODUÇÃO CONVENCIONAL
// Rotas de responsáveis, filas, operações em lote, etapas, Qualidade e retrabalho.
// Bloco movido integralmente do rotearV31Base; regras, SQL, permissões e mensagens preservados.

export async function handleConventionalProductionRoutesV47(request, env, url, caminho, deps) {
  const { LIMITE_LOTE_CONVENCIONAL, SETORES_CONVENCIONAIS_ATIVOS, SETORES_CONVENCIONAIS_V21, htmlResponse, isCoord, lerIdsLoteConvencional, listarAuditoriaConvencional, listarEtapasTrabalhoConvencional, listarFilaArticulacaoConvencional, listarFilaInclusaoConvencional, listarFilaMuflasConvencional, listarFilaQualidadeConvencional, listarFilaSetorPacienteConvencional, listarFuncionariosConvencionais, listarPecasCargaMuflaConvencional, listarPecasConvencionais, listarRastreioMuflasConvencional, listarRetrabalhosSetorConvencional, nomeSetorConvencional, obterCargaMuflaConvencionalPorId, obterEtapaConvencional, obterRetrabalhoConvencional, obterTrabalhoConvencional, obterUsuarioLogado, paginaRastreioMuflasConvencional, paginaSetorConvencional, paginaSetorInclusaoConvencional, paginaTrabalhoConvencional, podeOperarConvencional, proximoSetorConvencional, recalcularStatusTrabalhoConvencional, redirect, registrarAuditoriaConvencional, setoresUsuarioV31, textResponse, usuarioTemAreaConvencional } = deps;

      const rotaResponsaveisConvencional = caminho.match(/^\/convencional\/trabalhos\/(\d+)\/responsaveis$/);
      if (request.method === "POST" && rotaResponsaveisConvencional) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!isCoord(usuario)) return textResponse("Somente Administrador/Coordenador pode alterar responsáveis históricos.", 403);
        const trabalhoId = Number(rotaResponsaveisConvencional[1]);
        const dados = await request.formData();
        const setor = String(dados.get("setor") || "").toUpperCase();
        const motivo = String(dados.get("motivo") || "").trim();
        if (!SETORES_CONVENCIONAIS_ATIVOS.includes(setor) || motivo.length < 3) {
          return redirect(`/convencional/trabalhos/${trabalhoId}?erro=` + encodeURIComponent("Setor ou motivo inválido."));
        }

        const pecasResult = await env.db.prepare(`SELECT id, arcada FROM pecas_convencionais WHERE trabalho_id = ? ORDER BY arcada DESC`).bind(trabalhoId).all();
        const pecas = pecasResult.results || [];
        const validarResponsavel = async (id) => {
          if (!id) return null;
          return await env.db.prepare(`
            SELECT u.id, u.nome
            FROM usuarios u
            WHERE u.id = ?
              AND u.ativo = 1
              AND u.excluido = 0
              AND (
                u.perfil IN ('ADMINISTRADOR','COORDENADOR')
                OR EXISTS (
                  SELECT 1 FROM usuario_areas ua
                  WHERE ua.usuario_id = u.id
                    AND ua.area = 'CONVENCIONAL'
                    AND ua.ativo = 1
                )
              )
            LIMIT 1
          `).bind(id).first();
        };

        if (setor === "ARTICULACAO") {
          const novoId = Number(dados.get("responsavel_articulacao") || 0) || null;
          const novoUsuario = await validarResponsavel(novoId);
          if (novoId && !novoUsuario) return redirect(`/convencional/trabalhos/${trabalhoId}?erro=` + encodeURIComponent("Responsável inválido."));
          for (const peca of pecas) {
            const etapa = await env.db.prepare(`SELECT e.id, e.responsavel_id, u.nome AS responsavel_nome FROM etapas_convencionais e LEFT JOIN usuarios u ON u.id = e.responsavel_id WHERE e.peca_id = ? AND e.setor = ? LIMIT 1`).bind(peca.id, setor).first();
            if (!etapa || Number(etapa.responsavel_id || 0) === Number(novoId || 0)) continue;
            const antigo = etapa.responsavel_nome || "Sem responsável";
            const novo = novoUsuario?.nome || "Sem responsável";
            await env.db.prepare(`UPDATE etapas_convencionais SET responsavel_id = ? WHERE id = ?`).bind(novoId, etapa.id).run();
            if (["INCLUSAO", "ACRILIZACAO", "DESINCLUSAO"].includes(setor)) {
              const coluna = setor === "INCLUSAO" ? "incluido_por" : (setor === "ACRILIZACAO" ? "acrilizado_por" : "desincluido_por");
              await env.db.prepare(`UPDATE muflas_convencionais SET ${coluna} = ? WHERE id = (SELECT id FROM muflas_convencionais WHERE peca_id = ? ORDER BY id DESC LIMIT 1)`).bind(novoId, peca.id).run();
            }
            if (setor === "QUALIDADE") {
              await env.db.prepare(`UPDATE inspecoes_qualidade_convencional SET responsavel_id = ? WHERE id = (SELECT id FROM inspecoes_qualidade_convencional WHERE peca_id = ? ORDER BY id DESC LIMIT 1)`).bind(novoId, peca.id).run();
            }
            await registrarAuditoriaConvencional(env, trabalhoId, peca.id, etapa.id, "RESPONSAVEL_ALTERADO", setor, antigo, novo, motivo, usuario.id);
          }
        } else {
          for (const peca of pecas) {
            const campo = peca.arcada === "SUPERIOR" ? "responsavel_superior" : "responsavel_inferior";
            const novoId = Number(dados.get(campo) || 0) || null;
            const novoUsuario = await validarResponsavel(novoId);
            if (novoId && !novoUsuario) return redirect(`/convencional/trabalhos/${trabalhoId}?erro=` + encodeURIComponent("Responsável inválido."));
            const etapa = await env.db.prepare(`SELECT e.id, e.responsavel_id, u.nome AS responsavel_nome FROM etapas_convencionais e LEFT JOIN usuarios u ON u.id = e.responsavel_id WHERE e.peca_id = ? AND e.setor = ? LIMIT 1`).bind(peca.id, setor).first();
            if (!etapa || Number(etapa.responsavel_id || 0) === Number(novoId || 0)) continue;
            const antigo = etapa.responsavel_nome || "Sem responsável";
            const novo = novoUsuario?.nome || "Sem responsável";
            await env.db.prepare(`UPDATE etapas_convencionais SET responsavel_id = ? WHERE id = ?`).bind(novoId, etapa.id).run();
            if (["INCLUSAO", "ACRILIZACAO", "DESINCLUSAO"].includes(setor)) {
              const coluna = setor === "INCLUSAO" ? "incluido_por" : (setor === "ACRILIZACAO" ? "acrilizado_por" : "desincluido_por");
              await env.db.prepare(`UPDATE muflas_convencionais SET ${coluna} = ? WHERE id = (SELECT id FROM muflas_convencionais WHERE peca_id = ? ORDER BY id DESC LIMIT 1)`).bind(novoId, peca.id).run();
            }
            if (setor === "QUALIDADE") {
              await env.db.prepare(`UPDATE inspecoes_qualidade_convencional SET responsavel_id = ? WHERE id = (SELECT id FROM inspecoes_qualidade_convencional WHERE peca_id = ? ORDER BY id DESC LIMIT 1)`).bind(novoId, peca.id).run();
            }
            await registrarAuditoriaConvencional(env, trabalhoId, peca.id, etapa.id, "RESPONSAVEL_ALTERADO", setor, antigo, novo, motivo, usuario.id);
          }
        }
        return redirect(`/convencional/trabalhos/${trabalhoId}?ok=` + encodeURIComponent(`Responsáveis de ${nomeSetorConvencional(setor)} atualizados. A produção foi recalculada automaticamente.`) + `#gestao-responsaveis-${setor}`);
      }


      const rotaTrabalhoConvencional = caminho.match(/^\/convencional\/trabalhos\/(\d+)$/);
      if (request.method === "GET" && rotaTrabalhoConvencional) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!usuarioTemAreaConvencional(usuario)) return textResponse("Acesso negado.", 403);
        const trabalho = await obterTrabalhoConvencional(env, Number(rotaTrabalhoConvencional[1]));
        if (!trabalho) return textResponse("Trabalho convencional não encontrado.", 404);
        return htmlResponse(paginaTrabalhoConvencional(
          usuario,
          trabalho,
          await listarPecasConvencionais(env, trabalho.id),
          await listarEtapasTrabalhoConvencional(env, trabalho.id),
          await listarFuncionariosConvencionais(env),
          await listarAuditoriaConvencional(env, trabalho.id),
          url.searchParams.get("ok") || url.searchParams.get("erro") || "",
          url.searchParams.get("erro") ? "erro" : "sucesso"
        ));
      }

      if (request.method === "GET" && caminho === "/convencional/setor") {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!usuarioTemAreaConvencional(usuario)) return textResponse("Acesso negado.", 403);
        let setor = String(url.searchParams.get("setor") || "").toUpperCase();
        if (usuario.perfil === "FUNCIONARIO") {
          const permitidos = setoresUsuarioV31(usuario, "CONVENCIONAL");
          if (!permitidos.includes(setor)) setor = permitidos[0] || "";
        }
        if (!SETORES_CONVENCIONAIS_ATIVOS.includes(setor)) {
          if (usuario.perfil === "FUNCIONARIO") return textResponse("Nenhum setor convencional liberado para este usuário.", 403);
          setor = "ARTICULACAO";
        }
        const busca = String(url.searchParams.get("q") || "").trim();

        let filaSetor;
        if (setor === "QUALIDADE") {
          filaSetor = await listarFilaQualidadeConvencional(env, busca);
        } else if (setor === "ARTICULACAO") {
          filaSetor = await listarFilaArticulacaoConvencional(env, busca);
        } else if (setor === "INCLUSAO") {
          filaSetor = await listarFilaInclusaoConvencional(env, busca);
        } else if (["ACRILIZACAO", "DESINCLUSAO"].includes(setor)) {
          filaSetor = await listarFilaMuflasConvencional(env, setor, busca);
        } else {
          filaSetor = await listarFilaSetorPacienteConvencional(env, setor, busca);
        }
        const retrabalhosSetor = setor === "QUALIDADE" ? [] : await listarRetrabalhosSetorConvencional(env, setor, busca);

        return htmlResponse(paginaSetorConvencional(
          usuario,
          setor,
          filaSetor,
          busca,
          url.searchParams.get("ok") || url.searchParams.get("erro") || "",
          url.searchParams.get("erro") ? "erro" : "sucesso",
          retrabalhosSetor
        ));
      }



      if (request.method === "GET" && caminho === "/convencional/muflas") {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!usuarioTemAreaConvencional(usuario)) return textResponse("Acesso negado.", 403);
        const busca = String(url.searchParams.get("q") || "").trim();
        return htmlResponse(paginaRastreioMuflasConvencional(
          usuario,
          await listarRastreioMuflasConvencional(env, busca),
          busca
        ));
      }



      /* PRODUÇÃO CONVENCIONAL · AÇÕES EM LOTE V2.2.2 */

      if (request.method === "POST" && caminho === "/convencional/articulacao/lote/iniciar") {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!podeOperarConvencional(usuario, "ARTICULACAO")) return textResponse("Sem permissão para Articulação.", 403);
        const dados = await request.formData();
        const ids = lerIdsLoteConvencional(dados, "trabalho_id");
        if (!ids.length) return redirect(`/convencional/setor?setor=ARTICULACAO&erro=` + encodeURIComponent("Selecione pelo menos um paciente."));
        if (ids.length > LIMITE_LOTE_CONVENCIONAL) return redirect(`/convencional/setor?setor=ARTICULACAO&erro=` + encodeURIComponent(`O lote aceita até ${LIMITE_LOTE_CONVENCIONAL} pacientes por vez.`));
        const agora = new Date().toISOString();
        const statements = [];
        let totalPecas = 0;
        for (const trabalhoId of ids) {
          const trabalho = await obterTrabalhoConvencional(env, trabalhoId);
          if (!trabalho) return redirect(`/convencional/setor?setor=ARTICULACAO&erro=` + encodeURIComponent("Um dos pacientes selecionados não existe mais."));
          const etapasRes = await env.db.prepare(`SELECT e.id, e.status, e.responsavel_id, p.id AS peca_id FROM etapas_convencionais e INNER JOIN pecas_convencionais p ON p.id=e.peca_id WHERE p.trabalho_id=? AND e.setor='ARTICULACAO' AND e.status!='CONCLUIDO'`).bind(trabalhoId).all();
          const etapas = etapasRes.results || [];
          if (!etapas.length || etapas.some(e => e.status !== 'AGUARDANDO')) return redirect(`/convencional/setor?setor=ARTICULACAO&erro=` + encodeURIComponent(`Articulador ${trabalho.numero_articulador} não está aguardando início. Nenhum item do lote foi gravado.`));
          totalPecas += etapas.length;
          for (const etapa of etapas) {
            statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status='EM_ANDAMENTO', responsavel_id=?, iniciado_em=COALESCE(iniciado_em, ?) WHERE id=? AND status='AGUARDANDO'`).bind(usuario.id, agora, etapa.id));
            statements.push(env.db.prepare(`UPDATE pecas_convencionais SET setor_atual='ARTICULACAO', status='EM_ANDAMENTO' WHERE id=?`).bind(etapa.peca_id));
          }
        }
        await env.db.batch(statements);
        for (const id of ids) await recalcularStatusTrabalhoConvencional(env, id);
        return redirect(`/convencional/setor?setor=ARTICULACAO&ok=` + encodeURIComponent(`${ids.length} paciente(s) iniciados em lote · ${totalPecas} peça(s).`));
      }

      if (request.method === "POST" && caminho === "/convencional/articulacao/lote/concluir") {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!podeOperarConvencional(usuario, "ARTICULACAO")) return textResponse("Sem permissão para Articulação.", 403);
        const dados = await request.formData();
        const ids = lerIdsLoteConvencional(dados, "trabalho_id");
        if (!ids.length) return redirect(`/convencional/setor?setor=ARTICULACAO&erro=` + encodeURIComponent("Selecione pelo menos um paciente."));
        if (ids.length > LIMITE_LOTE_CONVENCIONAL) return redirect(`/convencional/setor?setor=ARTICULACAO&erro=` + encodeURIComponent(`O lote aceita até ${LIMITE_LOTE_CONVENCIONAL} pacientes por vez.`));
        const agora = new Date().toISOString();
        const statements = [];
        let totalPecas = 0;
        for (const trabalhoId of ids) {
          const trabalho = await obterTrabalhoConvencional(env, trabalhoId);
          if (!trabalho) return redirect(`/convencional/setor?setor=ARTICULACAO&erro=` + encodeURIComponent("Um dos pacientes selecionados não existe mais."));
          const etapasRes = await env.db.prepare(`SELECT e.id, e.status, e.responsavel_id, p.id AS peca_id FROM etapas_convencionais e INNER JOIN pecas_convencionais p ON p.id=e.peca_id WHERE p.trabalho_id=? AND e.setor='ARTICULACAO' AND e.status!='CONCLUIDO'`).bind(trabalhoId).all();
          const etapas = etapasRes.results || [];
          if (!etapas.length || etapas.some(e => e.status !== 'EM_ANDAMENTO')) return redirect(`/convencional/setor?setor=ARTICULACAO&erro=` + encodeURIComponent(`Articulador ${trabalho.numero_articulador} não está pronto para conclusão. Nenhum item do lote foi gravado.`));
          if (!isCoord(usuario) && etapas.some(e => Number(e.responsavel_id || 0) !== Number(usuario.id))) return redirect(`/convencional/setor?setor=ARTICULACAO&erro=` + encodeURIComponent(`Articulador ${trabalho.numero_articulador} está vinculado a outro funcionário. Nenhum item do lote foi gravado.`));
          totalPecas += etapas.length;
          for (const etapa of etapas) statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status='CONCLUIDO', concluido_em=? WHERE id=? AND status='EM_ANDAMENTO'`).bind(agora, etapa.id));
          statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status='AGUARDANDO' WHERE setor='MONTAGEM' AND status='BLOQUEADO' AND peca_id IN (SELECT id FROM pecas_convencionais WHERE trabalho_id=?)`).bind(trabalhoId));
          statements.push(env.db.prepare(`UPDATE pecas_convencionais SET setor_atual='MONTAGEM', status='AGUARDANDO' WHERE trabalho_id=?`).bind(trabalhoId));
        }
        await env.db.batch(statements);
        for (const id of ids) await recalcularStatusTrabalhoConvencional(env, id);
        return redirect(`/convencional/setor?setor=ARTICULACAO&ok=` + encodeURIComponent(`${ids.length} paciente(s) concluídos em lote · ${totalPecas} peça(s) liberadas para Montagem.`));
      }

      const rotaLotePaciente = caminho.match(/^\/convencional\/paciente\/lote\/(ENCERRAMENTO)\/(iniciar|concluir)$/);
      if (request.method === "POST" && rotaLotePaciente) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        const setor = rotaLotePaciente[1];
        const acao = rotaLotePaciente[2];
        if (!podeOperarConvencional(usuario, setor)) return textResponse("Sem permissão para este setor.", 403);
        const dados = await request.formData();
        const ids = lerIdsLoteConvencional(dados, "trabalho_id");
        if (!ids.length) return redirect(`/convencional/setor?setor=${setor}&erro=` + encodeURIComponent("Selecione pelo menos um paciente."));
        if (ids.length > LIMITE_LOTE_CONVENCIONAL) return redirect(`/convencional/setor?setor=${setor}&erro=` + encodeURIComponent(`O lote aceita até ${LIMITE_LOTE_CONVENCIONAL} pacientes por vez.`));
        const agora = new Date().toISOString();
        const statements = [];
        let totalPecas = 0;
        for (const trabalhoId of ids) {
          const trabalho = await obterTrabalhoConvencional(env, trabalhoId);
          if (!trabalho) return redirect(`/convencional/setor?setor=${setor}&erro=` + encodeURIComponent("Um dos pacientes selecionados não existe mais."));
          const etapasRes = await env.db.prepare(`SELECT e.id,e.status,e.responsavel_id,p.id AS peca_id FROM etapas_convencionais e INNER JOIN pecas_convencionais p ON p.id=e.peca_id WHERE p.trabalho_id=? AND e.setor=? AND e.status!='CONCLUIDO'`).bind(trabalhoId,setor).all();
          const etapas = etapasRes.results || [];
          if (!etapas.length) return redirect(`/convencional/setor?setor=${setor}&erro=` + encodeURIComponent(`Articulador ${trabalho.numero_articulador} já foi concluído. Nenhum item do lote foi gravado.`));
          if (acao === 'iniciar') {
            if (etapas.some(e => e.status !== 'AGUARDANDO')) return redirect(`/convencional/setor?setor=${setor}&erro=` + encodeURIComponent(`Articulador ${trabalho.numero_articulador} não está aguardando início. Nenhum item do lote foi gravado.`));
            const atribuicoes = etapas.map(e => Number(e.responsavel_id || 0)).filter(Boolean);
            if (usuario.perfil === 'FUNCIONARIO' && atribuicoes.some(id => id !== Number(usuario.id))) return redirect(`/convencional/setor?setor=${setor}&erro=` + encodeURIComponent(`Articulador ${trabalho.numero_articulador} é compartilhado ou atribuído a outro funcionário. Use o registro individual. Nenhum item do lote foi gravado.`));
            for (const etapa of etapas) {
              const responsavel = etapa.responsavel_id || usuario.id;
              statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status='EM_ANDAMENTO', responsavel_id=?, iniciado_em=COALESCE(iniciado_em, ?) WHERE id=? AND status='AGUARDANDO'`).bind(responsavel, agora, etapa.id));
              statements.push(env.db.prepare(`UPDATE pecas_convencionais SET setor_atual=?, status='EM_ANDAMENTO' WHERE id=?`).bind(setor, etapa.peca_id));
            }
          } else {
            if (etapas.some(e => e.status !== 'EM_ANDAMENTO')) return redirect(`/convencional/setor?setor=${setor}&erro=` + encodeURIComponent(`Articulador ${trabalho.numero_articulador} não está pronto para conclusão. Nenhum item do lote foi gravado.`));
            if (usuario.perfil === 'FUNCIONARIO' && etapas.some(e => Number(e.responsavel_id || 0) !== Number(usuario.id))) return redirect(`/convencional/setor?setor=${setor}&erro=` + encodeURIComponent(`Articulador ${trabalho.numero_articulador} possui responsabilidade compartilhada. Use o registro individual. Nenhum item do lote foi gravado.`));
            for (const etapa of etapas) statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status='CONCLUIDO', concluido_em=? WHERE id=? AND status='EM_ANDAMENTO'`).bind(agora, etapa.id));
            statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status='AGUARDANDO' WHERE setor='ESCULTURA' AND status='BLOQUEADO' AND peca_id IN (SELECT id FROM pecas_convencionais WHERE trabalho_id=?)`).bind(trabalhoId));
            statements.push(env.db.prepare(`UPDATE pecas_convencionais SET setor_atual='ESCULTURA', status='AGUARDANDO' WHERE trabalho_id=?`).bind(trabalhoId));
          }
          totalPecas += etapas.length;
        }
        await env.db.batch(statements);
        for (const id of ids) await recalcularStatusTrabalhoConvencional(env, id);
        return redirect(`/convencional/setor?setor=${setor}&ok=` + encodeURIComponent(`${ids.length} paciente(s) ${acao === 'iniciar' ? 'iniciados' : 'concluídos'} em lote · ${totalPecas} peça(s).`));
      }

      if (request.method === "POST" && caminho === "/convencional/inclusao/lote/registrar") {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!podeOperarConvencional(usuario, "INCLUSAO")) return textResponse("Sem permissão para Inclusão.", 403);
        const dados = await request.formData();
        const valores = {};
        const entradas = [];
        for (const [chave, valorBruto] of dados.entries()) {
          const m = String(chave).match(/^mufla_(\d+)$/);
          if (!m) continue;
          const texto = String(valorBruto || '').trim();
          valores[chave] = texto;
          if (!texto) continue;
          const pecaId = Number(m[1]);
          const numeroMufla = Number(texto);
          entradas.push({ pecaId, numeroMufla });
        }
        const erroInclusaoLote = async (mensagemErro) => htmlResponse(paginaSetorInclusaoConvencional(usuario, await listarFilaInclusaoConvencional(env, ""), "", mensagemErro, "erro", valores), 400);
        if (!entradas.length) return await erroInclusaoLote("Preencha ao menos uma mufla antes de confirmar o lote.");

        const porPeca = new Map();
        const trabalhosSelecionados = new Set();
        for (const entrada of entradas) {
          if (!Number.isInteger(entrada.numeroMufla) || entrada.numeroMufla < 1) return await erroInclusaoLote("Há um número de mufla inválido no lote.");
          const peca = await env.db.prepare(`SELECT p.id AS peca_id,p.trabalho_id,p.arcada,p.tipo_protese,t.numero_articulador,t.paciente,e.id AS etapa_id,e.status FROM pecas_convencionais p INNER JOIN trabalhos_convencionais t ON t.id=p.trabalho_id INNER JOIN etapas_convencionais e ON e.peca_id=p.id AND e.setor='INCLUSAO' WHERE p.id=? AND t.excluido=0 LIMIT 1`).bind(entrada.pecaId).first();
          if (!peca || peca.status !== 'AGUARDANDO') return await erroInclusaoLote("Uma das peças preenchidas não está mais aguardando Inclusão. Atualize a tela e tente novamente.");
          porPeca.set(Number(peca.peca_id), { ...peca, numeroMufla: entrada.numeroMufla });
          trabalhosSelecionados.add(Number(peca.trabalho_id));
        }
        if (trabalhosSelecionados.size > LIMITE_LOTE_CONVENCIONAL) return await erroInclusaoLote(`O lote aceita até ${LIMITE_LOTE_CONVENCIONAL} pacientes por vez.`);

        for (const trabalhoId of trabalhosSelecionados) {
          const pendentesRes = await env.db.prepare(`SELECT p.id AS peca_id,p.arcada FROM pecas_convencionais p INNER JOIN etapas_convencionais e ON e.peca_id=p.id AND e.setor='INCLUSAO' WHERE p.trabalho_id=? AND e.status!='CONCLUIDO'`).bind(trabalhoId).all();
          const pendentes = pendentesRes.results || [];
          const faltando = pendentes.find(p => !porPeca.has(Number(p.peca_id)));
          if (faltando) {
            const dadosTrab = await env.db.prepare(`SELECT numero_articulador,paciente FROM trabalhos_convencionais WHERE id=?`).bind(trabalhoId).first();
            return await erroInclusaoLote(`Articulador ${dadosTrab?.numero_articulador || trabalhoId} · ${dadosTrab?.paciente || ''}: preencha também a mufla da arcada ${faltando.arcada === 'SUPERIOR' ? 'SUP' : 'INF'}.`);
          }
        }

        const alocacoes = [...porPeca.values()];
        const grupos = new Map();
        for (const item of alocacoes) {
          if (!grupos.has(item.numeroMufla)) grupos.set(item.numeroMufla, []);
          grupos.get(item.numeroMufla).push(item);
        }
        for (const [numeroMufla, novos] of grupos.entries()) {
          if (novos.length > 1 && novos.some(p => p.tipo_protese !== 'PPR')) return await erroInclusaoLote(`Mufla ${numeroMufla}: somente PPR pode compartilhar a mesma carga.`);
          const carga = await env.db.prepare(`SELECT * FROM cargas_muflas_convencionais WHERE numero_mufla=? AND ativo=1 LIMIT 1`).bind(numeroMufla).first();
          if (carga) {
            if (carga.status !== 'INCLUIDA') return await erroInclusaoLote(`Mufla ${numeroMufla} já iniciou a Acrilização e não aceita novas peças.`);
            const existentes = await env.db.prepare(`SELECT p.tipo_protese,t.numero_articulador,t.paciente,p.arcada FROM muflas_convencionais m INNER JOIN pecas_convencionais p ON p.id=m.peca_id INNER JOIN trabalhos_convencionais t ON t.id=p.trabalho_id WHERE m.carga_id=? AND m.ativo=1`).bind(carga.id).all();
            const lista = existentes.results || [];
            if (novos.some(p => p.tipo_protese !== 'PPR') || lista.some(p => p.tipo_protese !== 'PPR')) return await erroInclusaoLote(`Mufla ${numeroMufla} está em carga exclusiva de PT. Apenas PPR pode compartilhar.`);
          }
        }

        const agora = new Date().toISOString();
        const statements = [];
        for (const [numeroMufla] of grupos.entries()) {
          statements.push(env.db.prepare(`INSERT OR IGNORE INTO cargas_muflas_convencionais (numero_mufla,status,ativo,incluido_por,incluido_em,criado_em) SELECT ?,'INCLUIDA',1,?,?,? WHERE NOT EXISTS (SELECT 1 FROM cargas_muflas_convencionais WHERE numero_mufla=? AND ativo=1)`).bind(numeroMufla, usuario.id, agora, agora, numeroMufla));
        }
        for (const item of alocacoes) {
          statements.push(env.db.prepare(`INSERT INTO muflas_convencionais (peca_id,numero_mufla,status,ativo,incluido_por,incluido_em,carga_id) VALUES (?,?,'INCLUIDA',1,?,?,(SELECT id FROM cargas_muflas_convencionais WHERE numero_mufla=? AND ativo=1 LIMIT 1))`).bind(item.peca_id,item.numeroMufla,usuario.id,agora,item.numeroMufla));
          statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status='CONCLUIDO',responsavel_id=?,iniciado_em=COALESCE(iniciado_em,?),concluido_em=? WHERE id=? AND status='AGUARDANDO'`).bind(usuario.id,agora,agora,item.etapa_id));
          statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status='AGUARDANDO' WHERE peca_id=? AND setor='ACRILIZACAO' AND status='BLOQUEADO'`).bind(item.peca_id));
          statements.push(env.db.prepare(`UPDATE pecas_convencionais SET setor_atual='ACRILIZACAO',status='AGUARDANDO' WHERE id=?`).bind(item.peca_id));
        }
        await env.db.batch(statements);
        for (const id of trabalhosSelecionados) await recalcularStatusTrabalhoConvencional(env, id);
        return redirect(`/convencional/setor?setor=INCLUSAO&ok=` + encodeURIComponent(`${trabalhosSelecionados.size} paciente(s) registrados em lote · ${alocacoes.length} peça(s) · ${grupos.size} mufla(s)/carga(s) utilizada(s).`));
      }

      const rotaLoteAcril = caminho.match(/^\/convencional\/cargas-mufla\/lote\/acrilizacao\/(iniciar|concluir)$/);
      if (request.method === "POST" && rotaLoteAcril) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!podeOperarConvencional(usuario, "ACRILIZACAO")) return textResponse("Sem permissão para Acrilização.", 403);
        const acao = rotaLoteAcril[1];
        const dados = await request.formData();
        const ids = lerIdsLoteConvencional(dados, "carga_id");
        if (!ids.length) return redirect(`/convencional/setor?setor=ACRILIZACAO&erro=` + encodeURIComponent("Selecione pelo menos uma carga."));
        if (ids.length > LIMITE_LOTE_CONVENCIONAL) return redirect(`/convencional/setor?setor=ACRILIZACAO&erro=` + encodeURIComponent(`O lote aceita até ${LIMITE_LOTE_CONVENCIONAL} cargas por vez.`));
        const agora = new Date().toISOString();
        const statements = [];
        const trabalhos = new Set();
        let totalPecas = 0;
        for (const cargaId of ids) {
          const carga = await obterCargaMuflaConvencionalPorId(env, cargaId);
          if (!carga || !Number(carga.ativo)) return redirect(`/convencional/setor?setor=ACRILIZACAO&erro=` + encodeURIComponent("Uma das cargas selecionadas não está mais ativa. Nenhum item do lote foi gravado."));
          const pecas = await listarPecasCargaMuflaConvencional(env, carga.id, 'ACRILIZACAO');
          if (!pecas.length) return redirect(`/convencional/setor?setor=ACRILIZACAO&erro=` + encodeURIComponent(`Mufla ${carga.numero_mufla} não possui peças válidas.`));
          if (acao === 'iniciar') {
            if (carga.status !== 'INCLUIDA' || pecas.some(p => p.etapa_status !== 'AGUARDANDO')) return redirect(`/convencional/setor?setor=ACRILIZACAO&erro=` + encodeURIComponent(`Mufla ${carga.numero_mufla} não está aguardando início. Nenhum item do lote foi gravado.`));
            statements.push(env.db.prepare(`UPDATE cargas_muflas_convencionais SET status='EM_ACRILIZACAO' WHERE id=? AND ativo=1`).bind(carga.id));
            statements.push(env.db.prepare(`UPDATE muflas_convencionais SET status='EM_ACRILIZACAO' WHERE carga_id=? AND ativo=1`).bind(carga.id));
            for (const item of pecas) {
              statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status='EM_ANDAMENTO',responsavel_id=?,iniciado_em=COALESCE(iniciado_em,?) WHERE id=? AND status='AGUARDANDO'`).bind(usuario.id,agora,item.etapa_id));
              statements.push(env.db.prepare(`UPDATE pecas_convencionais SET setor_atual='ACRILIZACAO',status='EM_ANDAMENTO' WHERE id=?`).bind(item.peca_id));
              trabalhos.add(Number(item.trabalho_id));
            }
          } else {
            if (carga.status !== 'EM_ACRILIZACAO' || pecas.some(p => p.etapa_status !== 'EM_ANDAMENTO')) return redirect(`/convencional/setor?setor=ACRILIZACAO&erro=` + encodeURIComponent(`Mufla ${carga.numero_mufla} não está pronta para conclusão. Nenhum item do lote foi gravado.`));
            if (!isCoord(usuario) && pecas.some(p => Number(p.responsavel_id || 0) !== Number(usuario.id))) return redirect(`/convencional/setor?setor=ACRILIZACAO&erro=` + encodeURIComponent(`Mufla ${carga.numero_mufla} está vinculada a outro funcionário. Nenhum item do lote foi gravado.`));
            statements.push(env.db.prepare(`UPDATE cargas_muflas_convencionais SET status='ACRILIZADA',acrilizado_por=?,acrilizado_em=? WHERE id=? AND ativo=1`).bind(usuario.id,agora,carga.id));
            statements.push(env.db.prepare(`UPDATE muflas_convencionais SET status='ACRILIZADA',acrilizado_por=?,acrilizado_em=? WHERE carga_id=? AND ativo=1`).bind(usuario.id,agora,carga.id));
            for (const item of pecas) {
              statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status='CONCLUIDO',concluido_em=? WHERE id=? AND status='EM_ANDAMENTO'`).bind(agora,item.etapa_id));
              statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status='AGUARDANDO' WHERE peca_id=? AND setor='DESINCLUSAO' AND status='BLOQUEADO'`).bind(item.peca_id));
              statements.push(env.db.prepare(`UPDATE pecas_convencionais SET setor_atual='DESINCLUSAO',status='AGUARDANDO' WHERE id=?`).bind(item.peca_id));
              trabalhos.add(Number(item.trabalho_id));
            }
          }
          totalPecas += pecas.length;
        }
        await env.db.batch(statements);
        for (const id of trabalhos) await recalcularStatusTrabalhoConvencional(env, id);
        return redirect(`/convencional/setor?setor=ACRILIZACAO&ok=` + encodeURIComponent(`${ids.length} carga(s) ${acao === 'iniciar' ? 'iniciadas' : 'concluídas'} em lote · ${totalPecas} peça(s).`));
      }

      if (request.method === "POST" && caminho === "/convencional/cargas-mufla/lote/desincluir") {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!podeOperarConvencional(usuario, "DESINCLUSAO")) return textResponse("Sem permissão para Desinclusão.", 403);
        const dados = await request.formData();
        const ids = lerIdsLoteConvencional(dados, "carga_id");
        if (!ids.length) return redirect(`/convencional/setor?setor=DESINCLUSAO&erro=` + encodeURIComponent("Selecione pelo menos uma carga."));
        if (ids.length > LIMITE_LOTE_CONVENCIONAL) return redirect(`/convencional/setor?setor=DESINCLUSAO&erro=` + encodeURIComponent(`O lote aceita até ${LIMITE_LOTE_CONVENCIONAL} cargas por vez.`));
        const agora = new Date().toISOString();
        const statements = [];
        const trabalhos = new Set();
        const selecionadasPorTrabalho = new Map();
        let totalPecas = 0;
        for (const cargaId of ids) {
          const carga = await obterCargaMuflaConvencionalPorId(env, cargaId);
          if (!carga || !Number(carga.ativo) || carga.status !== 'ACRILIZADA') return redirect(`/convencional/setor?setor=DESINCLUSAO&erro=` + encodeURIComponent("Uma das cargas selecionadas não está pronta para Desinclusão. Nenhum item do lote foi gravado."));
          const pecas = await listarPecasCargaMuflaConvencional(env, carga.id, 'DESINCLUSAO');
          if (!pecas.length || pecas.some(p => p.etapa_status !== 'AGUARDANDO')) return redirect(`/convencional/setor?setor=DESINCLUSAO&erro=` + encodeURIComponent(`Mufla ${carga.numero_mufla} não está pronta para Desinclusão. Nenhum item do lote foi gravado.`));
          statements.push(env.db.prepare(`UPDATE cargas_muflas_convencionais SET status='DESINCLUIDA',ativo=0,desincluido_por=?,desincluido_em=? WHERE id=? AND ativo=1`).bind(usuario.id,agora,carga.id));
          statements.push(env.db.prepare(`UPDATE muflas_convencionais SET status='DESINCLUIDA',ativo=0,desincluido_por=?,desincluido_em=? WHERE carga_id=? AND ativo=1`).bind(usuario.id,agora,carga.id));
          for (const item of pecas) {
            statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status='CONCLUIDO',responsavel_id=?,iniciado_em=COALESCE(iniciado_em,?),concluido_em=? WHERE id=? AND status='AGUARDANDO'`).bind(usuario.id,agora,agora,item.etapa_id));
            statements.push(env.db.prepare(`UPDATE pecas_convencionais SET setor_atual='DESINCLUSAO',status='CONCLUIDO' WHERE id=?`).bind(item.peca_id));
            const tid = Number(item.trabalho_id);
            trabalhos.add(tid);
            selecionadasPorTrabalho.set(tid, (selecionadasPorTrabalho.get(tid) || 0) + 1);
          }
          totalPecas += pecas.length;
        }
        for (const trabalhoId of trabalhos) {
          const pendentes = await env.db.prepare(`SELECT COUNT(*) AS total FROM pecas_convencionais p INNER JOIN etapas_convencionais e ON e.peca_id=p.id AND e.setor='DESINCLUSAO' WHERE p.trabalho_id=? AND e.status!='CONCLUIDO'`).bind(trabalhoId).first();
          if (Number(pendentes?.total || 0) === Number(selecionadasPorTrabalho.get(trabalhoId) || 0)) {
            statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status='AGUARDANDO' WHERE setor='ACABAMENTO' AND status='BLOQUEADO' AND peca_id IN (SELECT id FROM pecas_convencionais WHERE trabalho_id=?)`).bind(trabalhoId));
            statements.push(env.db.prepare(`UPDATE pecas_convencionais SET setor_atual='ACABAMENTO',status='AGUARDANDO' WHERE trabalho_id=?`).bind(trabalhoId));
          }
        }
        await env.db.batch(statements);
        for (const id of trabalhos) await recalcularStatusTrabalhoConvencional(env, id);
        return redirect(`/convencional/setor?setor=DESINCLUSAO&ok=` + encodeURIComponent(`${ids.length} carga(s) desincluídas e liberadas em lote · ${totalPecas} peça(s) recuperadas.`));
      }

      const rotaIniciarArticulacao = caminho.match(/^\/convencional\/articulacao\/(\d+)\/iniciar$/);
      if (request.method === "POST" && rotaIniciarArticulacao) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!podeOperarConvencional(usuario, "ARTICULACAO")) return textResponse("Sem permissão para Articulação.", 403);
        const trabalhoId = Number(rotaIniciarArticulacao[1]);
        const trabalho = await obterTrabalhoConvencional(env, trabalhoId);
        if (!trabalho) return textResponse("Trabalho convencional não encontrado.", 404);

        const emAndamentoOutro = await env.db.prepare(`
          SELECT e.responsavel_id, u.nome
          FROM etapas_convencionais e
          INNER JOIN pecas_convencionais p ON p.id = e.peca_id
          LEFT JOIN usuarios u ON u.id = e.responsavel_id
          WHERE p.trabalho_id = ? AND e.setor = 'ARTICULACAO' AND e.status = 'EM_ANDAMENTO'
          LIMIT 1
        `).bind(trabalhoId).first();
        if (emAndamentoOutro && !isCoord(usuario) && Number(emAndamentoOutro.responsavel_id) !== Number(usuario.id)) {
          return redirect(`/convencional/setor?setor=ARTICULACAO&erro=` + encodeURIComponent(`Articulação já iniciada por ${emAndamentoOutro.nome || "outro funcionário"}.`));
        }

        const agora = new Date().toISOString();
        await env.db.prepare(`
          UPDATE etapas_convencionais
          SET status = 'EM_ANDAMENTO', responsavel_id = ?, iniciado_em = COALESCE(iniciado_em, ?)
          WHERE setor = 'ARTICULACAO'
            AND status = 'AGUARDANDO'
            AND peca_id IN (SELECT id FROM pecas_convencionais WHERE trabalho_id = ?)
        `).bind(usuario.id, agora, trabalhoId).run();
        await env.db.prepare(`
          UPDATE pecas_convencionais
          SET setor_atual = 'ARTICULACAO', status = 'EM_ANDAMENTO'
          WHERE trabalho_id = ?
            AND id IN (
              SELECT p.id
              FROM pecas_convencionais p
              INNER JOIN etapas_convencionais e ON e.peca_id = p.id
              WHERE p.trabalho_id = ? AND e.setor = 'ARTICULACAO' AND e.status = 'EM_ANDAMENTO'
            )
        `).bind(trabalhoId, trabalhoId).run();
        await recalcularStatusTrabalhoConvencional(env, trabalhoId);
        return redirect(`/convencional/setor?setor=ARTICULACAO&ok=` + encodeURIComponent(`Articulador ${trabalho.numero_articulador}: articulação do paciente iniciada.`));
      }

      const rotaConcluirArticulacao = caminho.match(/^\/convencional\/articulacao\/(\d+)\/concluir$/);
      if (request.method === "POST" && rotaConcluirArticulacao) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!podeOperarConvencional(usuario, "ARTICULACAO")) return textResponse("Sem permissão para Articulação.", 403);
        const trabalhoId = Number(rotaConcluirArticulacao[1]);
        const trabalho = await obterTrabalhoConvencional(env, trabalhoId);
        if (!trabalho) return textResponse("Trabalho convencional não encontrado.", 404);

        const pendentes = await env.db.prepare(`
          SELECT e.id, e.status, e.responsavel_id
          FROM etapas_convencionais e
          INNER JOIN pecas_convencionais p ON p.id = e.peca_id
          WHERE p.trabalho_id = ? AND e.setor = 'ARTICULACAO' AND e.status != 'CONCLUIDO'
        `).bind(trabalhoId).all();
        const listaPendentes = pendentes.results || [];
        if (!listaPendentes.length) {
          return redirect(`/convencional/setor?setor=ARTICULACAO&ok=` + encodeURIComponent("Articulação já estava concluída."));
        }
        if (listaPendentes.some(item => item.status !== 'EM_ANDAMENTO')) {
          return redirect(`/convencional/setor?setor=ARTICULACAO&erro=` + encodeURIComponent("Inicie a articulação do paciente antes de concluir."));
        }
        if (!isCoord(usuario) && listaPendentes.some(item => Number(item.responsavel_id) !== Number(usuario.id))) {
          return textResponse("Esta articulação está vinculada a outro funcionário.", 403);
        }

        const quantidadeConcluida = listaPendentes.length;
        const agora = new Date().toISOString();
        await env.db.prepare(`
          UPDATE etapas_convencionais
          SET status = 'CONCLUIDO', concluido_em = ?
          WHERE setor = 'ARTICULACAO'
            AND status = 'EM_ANDAMENTO'
            AND peca_id IN (SELECT id FROM pecas_convencionais WHERE trabalho_id = ?)
        `).bind(agora, trabalhoId).run();

        await env.db.prepare(`
          UPDATE etapas_convencionais
          SET status = 'AGUARDANDO'
          WHERE setor = 'MONTAGEM'
            AND status = 'BLOQUEADO'
            AND peca_id IN (SELECT id FROM pecas_convencionais WHERE trabalho_id = ?)
        `).bind(trabalhoId).run();

        await env.db.prepare(`
          UPDATE pecas_convencionais
          SET setor_atual = 'MONTAGEM', status = 'AGUARDANDO'
          WHERE trabalho_id = ?
        `).bind(trabalhoId).run();
        await recalcularStatusTrabalhoConvencional(env, trabalhoId);
        return redirect(`/convencional/setor?setor=ARTICULACAO&ok=` + encodeURIComponent(`Articulador ${trabalho.numero_articulador}: articulação concluída. ${quantidadeConcluida} peça(s) registrada(s) e liberada(s) para Montagem.`));
      }


      const rotaRegistrarInclusao = caminho.match(/^\/convencional\/inclusao\/(\d+)\/registrar$/);
      if (request.method === "POST" && rotaRegistrarInclusao) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!podeOperarConvencional(usuario, "INCLUSAO")) return textResponse("Sem permissão para Inclusão.", 403);
        const trabalhoId = Number(rotaRegistrarInclusao[1]);
        const trabalho = await obterTrabalhoConvencional(env, trabalhoId);
        if (!trabalho) return textResponse("Trabalho convencional não encontrado.", 404);
        const dados = await request.formData();

        const resultado = await env.db.prepare(`
          SELECT p.id AS peca_id, p.arcada, p.tipo_protese, e.id AS etapa_id, e.status
          FROM pecas_convencionais p
          INNER JOIN etapas_convencionais e ON e.peca_id = p.id AND e.setor = 'INCLUSAO'
          WHERE p.trabalho_id = ?
          ORDER BY CASE p.arcada WHEN 'SUPERIOR' THEN 1 ELSE 2 END
        `).bind(trabalhoId).all();
        const pecas = resultado.results || [];
        const pendentes = pecas.filter(p => p.status !== 'CONCLUIDO');
        if (!pendentes.length) return redirect(`/convencional/setor?setor=INCLUSAO&ok=` + encodeURIComponent("Inclusão já registrada para este paciente."));
        if (pendentes.some(p => p.status !== 'AGUARDANDO')) return redirect(`/convencional/setor?setor=INCLUSAO&erro=` + encodeURIComponent("A Escultura ainda não liberou todas as peças deste paciente."));

        const alocacoes = [];
        for (const peca of pendentes) {
          const campo = peca.arcada === 'SUPERIOR' ? 'mufla_superior' : 'mufla_inferior';
          const numeroMufla = Number(dados.get(campo) || 0);
          if (!Number.isInteger(numeroMufla) || numeroMufla < 1) {
            return redirect(`/convencional/setor?setor=INCLUSAO&erro=` + encodeURIComponent(`Informe uma mufla válida para ${peca.arcada === 'SUPERIOR' ? 'SUP' : 'INF'}.`));
          }
          alocacoes.push({ ...peca, numeroMufla });
        }

        const grupos = new Map();
        for (const item of alocacoes) {
          if (!grupos.has(item.numeroMufla)) grupos.set(item.numeroMufla, []);
          grupos.get(item.numeroMufla).push(item);
        }

        const cargasPorNumero = new Map();
        for (const [numeroMufla, novos] of grupos.entries()) {
          if (novos.length > 1 && novos.some(p => p.tipo_protese !== 'PPR')) {
            return redirect(`/convencional/setor?setor=INCLUSAO&erro=` + encodeURIComponent(`Mufla ${numeroMufla}: somente peças PPR podem compartilhar a mesma carga.`));
          }

          let carga = await env.db.prepare(`
            SELECT * FROM cargas_muflas_convencionais
            WHERE numero_mufla = ? AND ativo = 1
            LIMIT 1
          `).bind(numeroMufla).first();

          if (carga) {
            if (carga.status !== 'INCLUIDA') {
              return redirect(`/convencional/setor?setor=INCLUSAO&erro=` + encodeURIComponent(`Mufla ${numeroMufla} já iniciou ${carga.status === 'EM_ACRILIZACAO' ? 'a Acrilização' : 'outra etapa'} e não aceita novas peças.`));
            }
            const existentes = await env.db.prepare(`
              SELECT p.tipo_protese, t.numero_articulador, t.paciente, p.arcada
              FROM muflas_convencionais m
              INNER JOIN pecas_convencionais p ON p.id = m.peca_id
              INNER JOIN trabalhos_convencionais t ON t.id = p.trabalho_id
              WHERE m.carga_id = ? AND m.ativo = 1
            `).bind(carga.id).all();
            const listaExistentes = existentes.results || [];
            if (novos.some(p => p.tipo_protese !== 'PPR') || listaExistentes.some(p => p.tipo_protese !== 'PPR')) {
              const ocupacao = listaExistentes[0]
                ? `${listaExistentes[0].numero_articulador} ${listaExistentes[0].arcada === 'SUPERIOR' ? 'SUP' : 'INF'} · ${listaExistentes[0].paciente}`
                : 'outra peça';
              return redirect(`/convencional/setor?setor=INCLUSAO&erro=` + encodeURIComponent(`Mufla ${numeroMufla} já está em uma carga exclusiva (${ocupacao}). Apenas PPR pode compartilhar mufla.`));
            }
          } else {
            const agoraCarga = new Date().toISOString();
            await env.db.prepare(`
              INSERT INTO cargas_muflas_convencionais (
                numero_mufla, status, ativo, incluido_por, incluido_em, criado_em
              ) VALUES (?, 'INCLUIDA', 1, ?, ?, ?)
            `).bind(numeroMufla, usuario.id, agoraCarga, agoraCarga).run();
            carga = await env.db.prepare(`
              SELECT * FROM cargas_muflas_convencionais
              WHERE numero_mufla = ? AND ativo = 1
              LIMIT 1
            `).bind(numeroMufla).first();
          }
          cargasPorNumero.set(numeroMufla, carga);
        }

        const agora = new Date().toISOString();
        const statements = [];
        for (const item of alocacoes) {
          const carga = cargasPorNumero.get(item.numeroMufla);
          statements.push(env.db.prepare(`
            INSERT INTO muflas_convencionais (
              peca_id, numero_mufla, status, ativo, incluido_por, incluido_em, carga_id
            ) VALUES (?, ?, 'INCLUIDA', 1, ?, ?, ?)
          `).bind(item.peca_id, item.numeroMufla, usuario.id, agora, carga.id));
          statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status = 'CONCLUIDO', responsavel_id = ?, iniciado_em = COALESCE(iniciado_em, ?), concluido_em = ? WHERE id = ? AND status = 'AGUARDANDO'`).bind(usuario.id, agora, agora, item.etapa_id));
          statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status = 'AGUARDANDO' WHERE peca_id = ? AND setor = 'ACRILIZACAO' AND status = 'BLOQUEADO'`).bind(item.peca_id));
          statements.push(env.db.prepare(`UPDATE pecas_convencionais SET setor_atual = 'ACRILIZACAO', status = 'AGUARDANDO' WHERE id = ?`).bind(item.peca_id));
        }
        await env.db.batch(statements);
        await recalcularStatusTrabalhoConvencional(env, trabalhoId);

        const resumos = [];
        for (const [numeroMufla, carga] of cargasPorNumero.entries()) {
          const qtd = await env.db.prepare(`SELECT COUNT(*) AS total FROM muflas_convencionais WHERE carga_id = ? AND ativo = 1`).bind(carga.id).first();
          resumos.push(`Mufla ${numeroMufla} · Carga #${carga.id}: ${Number(qtd?.total || 0)} peça(s)`);
        }
        return redirect(`/convencional/setor?setor=INCLUSAO&ok=` + encodeURIComponent(`Articulador ${trabalho.numero_articulador}: inclusão registrada. ${resumos.join(' · ')}. PPR compartilhados permanecem rastreados individualmente.`));
      }

      const rotaIniciarAcril = caminho.match(/^\/convencional\/cargas-mufla\/(\d+)\/acrilizacao\/iniciar$/);
      if (request.method === "POST" && rotaIniciarAcril) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!podeOperarConvencional(usuario, "ACRILIZACAO")) return textResponse("Sem permissão para Acrilização.", 403);
        const carga = await obterCargaMuflaConvencionalPorId(env, Number(rotaIniciarAcril[1]));
        if (!carga || !Number(carga.ativo)) return redirect(`/convencional/setor?setor=ACRILIZACAO&erro=` + encodeURIComponent("Carga de mufla não está ativa."));
        if (carga.status !== 'INCLUIDA') return redirect(`/convencional/setor?setor=ACRILIZACAO&erro=` + encodeURIComponent("Esta carga não está aguardando início da Acrilização."));
        const pecasCarga = await listarPecasCargaMuflaConvencional(env, carga.id, 'ACRILIZACAO');
        if (!pecasCarga.length || pecasCarga.some(p => p.etapa_status !== 'AGUARDANDO')) {
          return redirect(`/convencional/setor?setor=ACRILIZACAO&erro=` + encodeURIComponent("Nem todas as peças desta carga estão aguardando Acrilização."));
        }
        const agora = new Date().toISOString();
        const statements = [
          env.db.prepare(`UPDATE cargas_muflas_convencionais SET status = 'EM_ACRILIZACAO' WHERE id = ? AND ativo = 1`).bind(carga.id),
          env.db.prepare(`UPDATE muflas_convencionais SET status = 'EM_ACRILIZACAO' WHERE carga_id = ? AND ativo = 1`).bind(carga.id)
        ];
        for (const item of pecasCarga) {
          statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status = 'EM_ANDAMENTO', responsavel_id = ?, iniciado_em = COALESCE(iniciado_em, ?) WHERE id = ? AND status = 'AGUARDANDO'`).bind(usuario.id, agora, item.etapa_id));
          statements.push(env.db.prepare(`UPDATE pecas_convencionais SET setor_atual = 'ACRILIZACAO', status = 'EM_ANDAMENTO' WHERE id = ?`).bind(item.peca_id));
        }
        await env.db.batch(statements);
        for (const trabalhoId of [...new Set(pecasCarga.map(p => Number(p.trabalho_id)))]) await recalcularStatusTrabalhoConvencional(env, trabalhoId);
        return redirect(`/convencional/setor?setor=ACRILIZACAO&ok=` + encodeURIComponent(`Mufla ${carga.numero_mufla} · Carga #${carga.id} iniciada com ${pecasCarga.length} peça(s).`));
      }

      const rotaConcluirAcril = caminho.match(/^\/convencional\/cargas-mufla\/(\d+)\/acrilizacao\/concluir$/);
      if (request.method === "POST" && rotaConcluirAcril) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!podeOperarConvencional(usuario, "ACRILIZACAO")) return textResponse("Sem permissão para Acrilização.", 403);
        const carga = await obterCargaMuflaConvencionalPorId(env, Number(rotaConcluirAcril[1]));
        if (!carga || !Number(carga.ativo)) return redirect(`/convencional/setor?setor=ACRILIZACAO&erro=` + encodeURIComponent("Carga de mufla não está ativa."));
        const pecasCarga = await listarPecasCargaMuflaConvencional(env, carga.id, 'ACRILIZACAO');
        if (!pecasCarga.length || pecasCarga.some(p => p.etapa_status !== 'EM_ANDAMENTO')) {
          return redirect(`/convencional/setor?setor=ACRILIZACAO&erro=` + encodeURIComponent("Inicie a carga antes de concluir a Acrilização."));
        }
        if (!isCoord(usuario) && pecasCarga.some(p => Number(p.responsavel_id || 0) !== Number(usuario.id))) {
          return textResponse("Esta carga está vinculada a outro funcionário ou possui responsáveis divergentes. A Gerência deve corrigir antes da conclusão.", 403);
        }
        const agora = new Date().toISOString();
        const responsavelId = usuario.id;
        const statements = [
          env.db.prepare(`UPDATE cargas_muflas_convencionais SET status = 'ACRILIZADA', acrilizado_por = ?, acrilizado_em = ? WHERE id = ? AND ativo = 1`).bind(responsavelId, agora, carga.id),
          env.db.prepare(`UPDATE muflas_convencionais SET status = 'ACRILIZADA', acrilizado_por = ?, acrilizado_em = ? WHERE carga_id = ? AND ativo = 1`).bind(responsavelId, agora, carga.id)
        ];
        for (const item of pecasCarga) {
          statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status = 'CONCLUIDO', concluido_em = ? WHERE id = ? AND status = 'EM_ANDAMENTO'`).bind(agora, item.etapa_id));
          statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status = 'AGUARDANDO' WHERE peca_id = ? AND setor = 'DESINCLUSAO' AND status = 'BLOQUEADO'`).bind(item.peca_id));
          statements.push(env.db.prepare(`UPDATE pecas_convencionais SET setor_atual = 'DESINCLUSAO', status = 'AGUARDANDO' WHERE id = ?`).bind(item.peca_id));
        }
        await env.db.batch(statements);
        for (const trabalhoId of [...new Set(pecasCarga.map(p => Number(p.trabalho_id)))]) await recalcularStatusTrabalhoConvencional(env, trabalhoId);
        return redirect(`/convencional/setor?setor=ACRILIZACAO&ok=` + encodeURIComponent(`Mufla ${carga.numero_mufla} · Carga #${carga.id} acrilizada. ${pecasCarga.length} peça(s) contabilizada(s) e liberada(s) para Desinclusão.`));
      }

      const rotaDesincluirMufla = caminho.match(/^\/convencional\/cargas-mufla\/(\d+)\/desincluir$/);
      if (request.method === "POST" && rotaDesincluirMufla) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!podeOperarConvencional(usuario, "DESINCLUSAO")) return textResponse("Sem permissão para Desinclusão.", 403);
        const carga = await obterCargaMuflaConvencionalPorId(env, Number(rotaDesincluirMufla[1]));
        if (!carga || !Number(carga.ativo)) return redirect(`/convencional/setor?setor=DESINCLUSAO&erro=` + encodeURIComponent("Carga já foi liberada ou não existe."));
        if (carga.status !== 'ACRILIZADA') return redirect(`/convencional/setor?setor=DESINCLUSAO&erro=` + encodeURIComponent("Esta carga ainda não concluiu a Acrilização."));
        const pecasCarga = await listarPecasCargaMuflaConvencional(env, carga.id, 'DESINCLUSAO');
        if (!pecasCarga.length || pecasCarga.some(p => p.etapa_status !== 'AGUARDANDO')) {
          return redirect(`/convencional/setor?setor=DESINCLUSAO&erro=` + encodeURIComponent("Nem todas as peças desta carga estão prontas para Desinclusão."));
        }
        const agora = new Date().toISOString();
        const statements = [
          env.db.prepare(`UPDATE cargas_muflas_convencionais SET status = 'DESINCLUIDA', ativo = 0, desincluido_por = ?, desincluido_em = ? WHERE id = ? AND ativo = 1`).bind(usuario.id, agora, carga.id),
          env.db.prepare(`UPDATE muflas_convencionais SET status = 'DESINCLUIDA', ativo = 0, desincluido_por = ?, desincluido_em = ? WHERE carga_id = ? AND ativo = 1`).bind(usuario.id, agora, carga.id)
        ];
        for (const item of pecasCarga) {
          statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status = 'CONCLUIDO', responsavel_id = ?, iniciado_em = COALESCE(iniciado_em, ?), concluido_em = ? WHERE id = ? AND status = 'AGUARDANDO'`).bind(usuario.id, agora, agora, item.etapa_id));
          statements.push(env.db.prepare(`UPDATE pecas_convencionais SET setor_atual = 'DESINCLUSAO', status = 'CONCLUIDO' WHERE id = ?`).bind(item.peca_id));
        }
        await env.db.batch(statements);

        const trabalhosIds = [...new Set(pecasCarga.map(p => Number(p.trabalho_id)))];
        const mensagensTrabalhos = [];
        for (const trabalhoId of trabalhosIds) {
          const dadosTrabalho = await env.db.prepare(`SELECT numero_articulador, paciente FROM trabalhos_convencionais WHERE id = ? LIMIT 1`).bind(trabalhoId).first();
          const pendentes = await env.db.prepare(`
            SELECT COUNT(*) AS total
            FROM pecas_convencionais p
            INNER JOIN etapas_convencionais e ON e.peca_id = p.id AND e.setor = 'DESINCLUSAO'
            WHERE p.trabalho_id = ? AND e.status != 'CONCLUIDO'
          `).bind(trabalhoId).first();
          if (Number(pendentes?.total || 0) === 0) {
            await env.db.batch([
              env.db.prepare(`UPDATE etapas_convencionais SET status = 'AGUARDANDO' WHERE setor = 'ACABAMENTO' AND status = 'BLOQUEADO' AND peca_id IN (SELECT id FROM pecas_convencionais WHERE trabalho_id = ?)`).bind(trabalhoId),
              env.db.prepare(`UPDATE pecas_convencionais SET setor_atual = 'ACABAMENTO', status = 'AGUARDANDO' WHERE trabalho_id = ?`).bind(trabalhoId)
            ]);
            mensagensTrabalhos.push(`Articulador ${dadosTrabalho?.numero_articulador || trabalhoId} → Acabamento`);
          } else {
            const par = await env.db.prepare(`
              SELECT m.numero_mufla, p.arcada
              FROM pecas_convencionais p
              INNER JOIN muflas_convencionais m ON m.peca_id = p.id AND m.ativo = 1
              WHERE p.trabalho_id = ?
              LIMIT 1
            `).bind(trabalhoId).first();
            mensagensTrabalhos.push(`Articulador ${dadosTrabalho?.numero_articulador || trabalhoId}${par ? ` · par continua na Mufla ${par.numero_mufla}` : ' · aguardando o par'}`);
          }
          await recalcularStatusTrabalhoConvencional(env, trabalhoId);
        }

        const recuperadas = pecasCarga.map(p => `${p.numero_articulador} ${p.arcada === 'SUPERIOR' ? 'SUP' : 'INF'} · ${p.paciente}`).join('; ');
        return redirect(`/convencional/setor?setor=DESINCLUSAO&ok=` + encodeURIComponent(`Mufla ${carga.numero_mufla} · Carga #${carga.id} liberada. Recuperadas: ${recuperadas}. ${mensagensTrabalhos.join(' · ')}`));
      }


      const rotaIniciarPacienteConvencional = caminho.match(/^\/convencional\/paciente\/(\d+)\/(MONTAGEM|ENCERRAMENTO|ESCULTURA|ACABAMENTO)\/iniciar$/);
      if (request.method === "POST" && rotaIniciarPacienteConvencional) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        const trabalhoId = Number(rotaIniciarPacienteConvencional[1]);
        const setor = String(rotaIniciarPacienteConvencional[2]);
        if (!podeOperarConvencional(usuario, setor)) return textResponse("Sem permissão para este setor.", 403);
        const trabalho = await obterTrabalhoConvencional(env, trabalhoId);
        if (!trabalho) return textResponse("Trabalho convencional não encontrado.", 404);

        const resultado = await env.db.prepare(`
          SELECT e.id, e.status, e.responsavel_id, p.id AS peca_id, p.arcada
          FROM etapas_convencionais e
          INNER JOIN pecas_convencionais p ON p.id = e.peca_id
          WHERE p.trabalho_id = ? AND e.setor = ?
        `).bind(trabalhoId, setor).all();
        const etapas = resultado.results || [];
        const pendentes = etapas.filter(e => e.status !== 'CONCLUIDO');
        if (!pendentes.length) return redirect(`/convencional/setor?setor=${setor}&ok=` + encodeURIComponent("Este paciente já foi concluído neste setor."));
        if (pendentes.some(e => e.status === 'BLOQUEADO')) return redirect(`/convencional/setor?setor=${setor}&erro=` + encodeURIComponent("O setor anterior ainda não liberou todas as peças deste paciente."));
        if (pendentes.some(e => e.status === 'EM_ANDAMENTO')) return redirect(`/convencional/setor?setor=${setor}&erro=` + encodeURIComponent("Este paciente já está em andamento."));

        const preAtribuidos = pendentes.map(e => Number(e.responsavel_id || 0)).filter(Boolean);
        if (usuario.perfil === 'FUNCIONARIO' && preAtribuidos.length && !preAtribuidos.includes(Number(usuario.id))) {
          return redirect(`/convencional/setor?setor=${setor}&erro=` + encodeURIComponent("Este paciente já foi atribuído pela gestão a outro(s) funcionário(s)."));
        }

        const agora = new Date().toISOString();
        const stmts=[];
        for (const etapa of pendentes) {
          const responsavelId = etapa.responsavel_id || usuario.id;
          stmts.push(env.db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM etapas_convencionais WHERE id=? AND status='AGUARDANDO' AND (responsavel_id IS NULL OR responsavel_id IS ?)) THEN 1 ELSE json('conflito_convencional') END`).bind(etapa.id,etapa.responsavel_id??null));
          stmts.push(env.db.prepare(`UPDATE etapas_convencionais SET status='EM_ANDAMENTO', responsavel_id=?, iniciado_em=COALESCE(iniciado_em,?) WHERE id=? AND status='AGUARDANDO'`).bind(responsavelId,agora,etapa.id));
          stmts.push(env.db.prepare(`UPDATE pecas_convencionais SET setor_atual=?, status='EM_ANDAMENTO' WHERE id=?`).bind(setor,etapa.peca_id));
        }
        try{await env.db.batch(stmts);}catch{return redirect(`/convencional/setor?setor=${setor}&erro=`+encodeURIComponent("O paciente mudou em outra sessão. Atualize a página antes de iniciar."));}
        await recalcularStatusTrabalhoConvencional(env, trabalhoId);
        return redirect(`/convencional/setor?setor=${setor}&ok=` + encodeURIComponent(`Articulador ${trabalho.numero_articulador}: ${nomeSetorConvencional(setor)} iniciada para o paciente inteiro.`));
      }

      const rotaConcluirPacienteConvencional = caminho.match(/^\/convencional\/paciente\/(\d+)\/(MONTAGEM|ENCERRAMENTO|ESCULTURA|ACABAMENTO)\/concluir$/);
      if (request.method === "POST" && rotaConcluirPacienteConvencional) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        const trabalhoId = Number(rotaConcluirPacienteConvencional[1]);
        const setor = String(rotaConcluirPacienteConvencional[2]);
        if (!podeOperarConvencional(usuario, setor)) return textResponse("Sem permissão para este setor.", 403);
        const trabalho = await obterTrabalhoConvencional(env, trabalhoId);
        if (!trabalho) return textResponse("Trabalho convencional não encontrado.", 404);

        const resultado = await env.db.prepare(`
          SELECT e.id, e.status, e.responsavel_id, p.id AS peca_id, p.arcada
          FROM etapas_convencionais e
          INNER JOIN pecas_convencionais p ON p.id = e.peca_id
          WHERE p.trabalho_id = ? AND e.setor = ?
        `).bind(trabalhoId, setor).all();
        const etapas = resultado.results || [];
        const pendentes = etapas.filter(e => e.status !== 'CONCLUIDO');
        if (!pendentes.length) return redirect(`/convencional/setor?setor=${setor}&ok=` + encodeURIComponent("Este paciente já estava concluído neste setor."));

        const alvo = usuario.perfil === 'FUNCIONARIO'
          ? pendentes.filter(e => Number(e.responsavel_id || 0) === Number(usuario.id))
          : pendentes;
        if (!alvo.length) return textResponse("Nenhuma arcada deste paciente está vinculada a você neste setor.", 403);
        if (alvo.some(e => e.status !== 'EM_ANDAMENTO')) return redirect(`/convencional/setor?setor=${setor}&erro=` + encodeURIComponent("Inicie sua(s) arcada(s) antes de concluir."));

        const agora = new Date().toISOString();
        const proximo = proximoSetorConvencional(setor);
        const stmts=[];
        for (const etapa of alvo) {
          stmts.push(env.db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM etapas_convencionais WHERE id=? AND status='EM_ANDAMENTO' AND responsavel_id IS ?) THEN 1 ELSE json('conflito_convencional') END`).bind(etapa.id,etapa.responsavel_id??null));
          stmts.push(env.db.prepare(`UPDATE etapas_convencionais SET status='CONCLUIDO', concluido_em=? WHERE id=? AND status='EM_ANDAMENTO' AND responsavel_id IS ?`).bind(agora, etapa.id, etapa.responsavel_id ?? null));
          if (proximo && SETORES_CONVENCIONAIS_ATIVOS.includes(proximo)) {
            stmts.push(env.db.prepare(`UPDATE etapas_convencionais SET status='AGUARDANDO' WHERE peca_id=? AND setor=? AND status='BLOQUEADO'`).bind(etapa.peca_id, proximo));
            stmts.push(env.db.prepare(`UPDATE pecas_convencionais SET setor_atual=?, status='AGUARDANDO' WHERE id=?`).bind(proximo, etapa.peca_id));
          }
        }
        try{await env.db.batch(stmts);}catch{return redirect(`/convencional/setor?setor=${setor}&erro=`+encodeURIComponent("Uma das arcadas mudou em outra sessão. Nenhuma conclusão deste clique foi gravada."));}
        await recalcularStatusTrabalhoConvencional(env, trabalhoId);
        const restantesOutros = pendentes.length - alvo.length;
        const textoConclusao = setor === "ACABAMENTO"
          ? `Articulador ${trabalho.numero_articulador}: Acabamento concluído em ${alvo.length} arcada(s) sob sua responsabilidade e liberado para Qualidade.${restantesOutros>0?` ${restantesOutros} arcada(s) continuam com outro responsável.`:""}`
          : `Articulador ${trabalho.numero_articulador}: ${nomeSetorConvencional(setor)} concluída em ${alvo.length} arcada(s), preservando o responsável de cada peça.${restantesOutros>0?` ${restantesOutros} arcada(s) continuam pendentes com outro responsável.`:""}`;
        return redirect(`/convencional/setor?setor=${setor}&ok=` + encodeURIComponent(textoConclusao));
      }

      if (request.method === "POST" && caminho === "/convencional/qualidade/lote/aprovar") {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!podeOperarConvencional(usuario, "QUALIDADE")) return textResponse("Sem permissão para Qualidade.", 403);

        const dados = await request.formData();
        const ids = lerIdsLoteConvencional(dados, "peca_id");
        if (!ids.length) return redirect(`/convencional/setor?setor=QUALIDADE&erro=` + encodeURIComponent("Selecione pelo menos uma peça para aprovação em lote."));
        if (ids.length > LIMITE_LOTE_CONVENCIONAL) return redirect(`/convencional/setor?setor=QUALIDADE&erro=` + encodeURIComponent(`O limite é de ${LIMITE_LOTE_CONVENCIONAL} peças por lote.`));

        const placeholders = ids.map(() => '?').join(',');
        const resultado = await env.db.prepare(`
          SELECT
            p.id AS peca_id,
            p.trabalho_id,
            p.arcada,
            t.numero_articulador,
            t.paciente,
            q.id AS etapa_id,
            q.status AS qualidade_status,
            EXISTS(
              SELECT 1 FROM retrabalhos_convencionais r
              WHERE r.peca_id = p.id AND r.status IN ('AGUARDANDO','EM_ANDAMENTO')
            ) AS retrabalho_ativo
          FROM pecas_convencionais p
          INNER JOIN trabalhos_convencionais t ON t.id = p.trabalho_id
          INNER JOIN etapas_convencionais q ON q.peca_id = p.id AND q.setor = 'QUALIDADE'
          WHERE p.id IN (${placeholders}) AND t.excluido = 0
        `).bind(...ids).all();
        const pecas = resultado.results || [];

        if (pecas.length !== ids.length) {
          return redirect(`/convencional/setor?setor=QUALIDADE&erro=` + encodeURIComponent("Uma ou mais peças selecionadas não foram encontradas. Nenhuma aprovação foi registrada."));
        }

        const invalidas = pecas.filter(p => String(p.qualidade_status || '') !== 'AGUARDANDO' || Number(p.retrabalho_ativo));
        if (invalidas.length) {
          const resumo = invalidas.slice(0, 5).map(p => `${p.numero_articulador} ${p.arcada === 'SUPERIOR' ? 'SUP' : 'INF'}`).join(', ');
          return redirect(`/convencional/setor?setor=QUALIDADE&erro=` + encodeURIComponent(`O lote não foi gravado. ${invalidas.length} peça(s) não estão disponíveis para aprovação: ${resumo}${invalidas.length > 5 ? '...' : ''}`));
        }

        const agora = new Date().toISOString();
        const statements = [];
        for (const peca of pecas) {
          statements.push(env.db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM etapas_convencionais q WHERE q.id=? AND q.status='AGUARDANDO') AND NOT EXISTS(SELECT 1 FROM retrabalhos_convencionais r WHERE r.peca_id=? AND r.status IN ('AGUARDANDO','EM_ANDAMENTO')) THEN 1 ELSE json('conflito_qualidade') END`).bind(peca.etapa_id,peca.peca_id));
          statements.push(env.db.prepare(`INSERT INTO inspecoes_qualidade_convencional (trabalho_id, peca_id, resultado, motivo, setor_retorno, responsavel_id, criado_em) VALUES (?, ?, 'APROVADO', NULL, NULL, ?, ?)`).bind(peca.trabalho_id, peca.peca_id, usuario.id, agora));
          statements.push(env.db.prepare(`UPDATE etapas_convencionais SET status='CONCLUIDO', responsavel_id=?, iniciado_em=COALESCE(iniciado_em, ?), concluido_em=? WHERE id=? AND status='AGUARDANDO'`).bind(usuario.id, agora, agora, peca.etapa_id));
          statements.push(env.db.prepare(`UPDATE pecas_convencionais SET setor_atual='LIBERADO_ENTREGA', status='CONCLUIDO' WHERE id=?`).bind(peca.peca_id));
        }
        try{await env.db.batch(statements);}catch{return redirect(`/convencional/setor?setor=QUALIDADE&erro=`+encodeURIComponent("Uma das peças mudou durante a aprovação. Nenhuma peça deste lote foi aprovada; atualize a página."));}

        const trabalhos = [...new Set(pecas.map(p => Number(p.trabalho_id)))];
        let pacientesLiberados = 0;
        for (const trabalhoId of trabalhos) {
          await recalcularStatusTrabalhoConvencional(env, trabalhoId);
          const pendentes = await env.db.prepare(`SELECT COUNT(*) AS total FROM pecas_convencionais p INNER JOIN etapas_convencionais q ON q.peca_id=p.id AND q.setor='QUALIDADE' WHERE p.trabalho_id=? AND q.status!='CONCLUIDO'`).bind(trabalhoId).first();
          if (Number(pendentes?.total || 0) === 0) pacientesLiberados++;
        }

        return redirect(`/convencional/setor?setor=QUALIDADE&ok=` + encodeURIComponent(`${pecas.length} peça(s) aprovadas em lote. ${pacientesLiberados} paciente(s) totalmente liberado(s) para entrega.`));
      }

      const rotaAprovarQualidade = caminho.match(/^\/convencional\/qualidade\/(\d+)\/aprovar$/);
      if (request.method === "POST" && rotaAprovarQualidade) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!podeOperarConvencional(usuario, "QUALIDADE")) return textResponse("Sem permissão para Qualidade.", 403);
        const pecaId = Number(rotaAprovarQualidade[1]);
        const peca = await env.db.prepare(`
          SELECT p.*, t.numero_articulador, t.paciente
          FROM pecas_convencionais p
          INNER JOIN trabalhos_convencionais t ON t.id = p.trabalho_id
          WHERE p.id = ? AND t.excluido = 0 LIMIT 1
        `).bind(pecaId).first();
        if (!peca) return textResponse("Peça não encontrada.", 404);
        const etapa = await env.db.prepare(`SELECT * FROM etapas_convencionais WHERE peca_id = ? AND setor = 'QUALIDADE' LIMIT 1`).bind(pecaId).first();
        if (!etapa || etapa.status !== 'AGUARDANDO') return redirect(`/convencional/setor?setor=QUALIDADE&erro=` + encodeURIComponent("Esta peça não está aguardando inspeção."));
        const ativo = await env.db.prepare(`SELECT id FROM retrabalhos_convencionais WHERE peca_id = ? AND status IN ('AGUARDANDO','EM_ANDAMENTO') LIMIT 1`).bind(pecaId).first();
        if (ativo) return redirect(`/convencional/setor?setor=QUALIDADE&erro=` + encodeURIComponent("Esta peça possui um retrabalho ativo e ainda não pode ser aprovada."));
        const agora = new Date().toISOString();
        try{await env.db.batch([
          env.db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM etapas_convencionais WHERE id=? AND status='AGUARDANDO') AND NOT EXISTS(SELECT 1 FROM retrabalhos_convencionais WHERE peca_id=? AND status IN ('AGUARDANDO','EM_ANDAMENTO')) THEN 1 ELSE json('conflito_qualidade') END`).bind(etapa.id,pecaId),
          env.db.prepare(`INSERT INTO inspecoes_qualidade_convencional (trabalho_id, peca_id, resultado, motivo, setor_retorno, responsavel_id, criado_em) VALUES (?, ?, 'APROVADO', NULL, NULL, ?, ?)`).bind(peca.trabalho_id, pecaId, usuario.id, agora),
          env.db.prepare(`UPDATE etapas_convencionais SET status='CONCLUIDO', responsavel_id=?, iniciado_em=COALESCE(iniciado_em, ?), concluido_em=? WHERE id=? AND status='AGUARDANDO'`).bind(usuario.id, agora, agora, etapa.id),
          env.db.prepare(`UPDATE pecas_convencionais SET setor_atual='LIBERADO_ENTREGA', status='CONCLUIDO' WHERE id=?`).bind(pecaId)
        ]);}catch{return redirect(`/convencional/setor?setor=QUALIDADE&erro=`+encodeURIComponent("A peça mudou durante a aprovação. Atualize a página; nenhuma aprovação deste clique foi gravada."));}
        await recalcularStatusTrabalhoConvencional(env, peca.trabalho_id);
        const pendentes = await env.db.prepare(`SELECT COUNT(*) AS total FROM pecas_convencionais p INNER JOIN etapas_convencionais q ON q.peca_id=p.id AND q.setor='QUALIDADE' WHERE p.trabalho_id=? AND q.status!='CONCLUIDO'`).bind(peca.trabalho_id).first();
        const arcada = peca.arcada === 'SUPERIOR' ? 'SUP' : 'INF';
        const extra = Number(pendentes?.total || 0) === 0 ? ' Paciente totalmente aprovado e liberado para entrega.' : '';
        return redirect(`/convencional/setor?setor=QUALIDADE&ok=` + encodeURIComponent(`${peca.numero_articulador} ${arcada} · ${peca.paciente}: aprovada.${extra}`));
      }

      const rotaReprovarQualidade = caminho.match(/^\/convencional\/qualidade\/(\d+)\/reprovar$/);
      if (request.method === "POST" && rotaReprovarQualidade) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        if (!podeOperarConvencional(usuario, "QUALIDADE")) return textResponse("Sem permissão para Qualidade.", 403);
        const pecaId = Number(rotaReprovarQualidade[1]);
        const dados = await request.formData();
        const motivo = String(dados.get('motivo') || '').trim();
        const setorRetorno = String(dados.get('setor_retorno') || '').toUpperCase();
        const setoresPermitidos = ["ARTICULACAO","MONTAGEM","ENCERRAMENTO","ESCULTURA","INCLUSAO","ACRILIZACAO","DESINCLUSAO","ACABAMENTO"];
        if (motivo.length < 3 || !setoresPermitidos.includes(setorRetorno)) return redirect(`/convencional/setor?setor=QUALIDADE&erro=` + encodeURIComponent("Informe o motivo e um setor de retorno válido."));
        const peca = await env.db.prepare(`SELECT p.*, t.numero_articulador, t.paciente FROM pecas_convencionais p INNER JOIN trabalhos_convencionais t ON t.id=p.trabalho_id WHERE p.id=? AND t.excluido=0 LIMIT 1`).bind(pecaId).first();
        if (!peca) return textResponse("Peça não encontrada.", 404);
        const etapa = await env.db.prepare(`SELECT * FROM etapas_convencionais WHERE peca_id=? AND setor='QUALIDADE' LIMIT 1`).bind(pecaId).first();
        if (!etapa || etapa.status !== 'AGUARDANDO') return redirect(`/convencional/setor?setor=QUALIDADE&erro=` + encodeURIComponent("Esta peça não está aguardando inspeção."));
        const ativo = await env.db.prepare(`SELECT id FROM retrabalhos_convencionais WHERE peca_id=? AND status IN ('AGUARDANDO','EM_ANDAMENTO') LIMIT 1`).bind(pecaId).first();
        if (ativo) return redirect(`/convencional/setor?setor=QUALIDADE&erro=` + encodeURIComponent("Já existe um retrabalho ativo para esta peça."));
        const agora = new Date().toISOString();
        try{await env.db.batch([
          env.db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM etapas_convencionais WHERE id=? AND status='AGUARDANDO') AND NOT EXISTS(SELECT 1 FROM retrabalhos_convencionais WHERE peca_id=? AND status IN ('AGUARDANDO','EM_ANDAMENTO')) THEN 1 ELSE json('conflito_qualidade') END`).bind(etapa.id,pecaId),
          env.db.prepare(`INSERT INTO inspecoes_qualidade_convencional (trabalho_id, peca_id, resultado, motivo, setor_retorno, responsavel_id, criado_em) VALUES (?, ?, 'REPROVADO', ?, ?, ?, ?)`).bind(peca.trabalho_id,pecaId,motivo,setorRetorno,usuario.id,agora),
          env.db.prepare(`INSERT INTO retrabalhos_convencionais (trabalho_id, peca_id, inspecao_id, setor_retorno, motivo, status, criado_por, criado_em) VALUES (?, ?, (SELECT id FROM inspecoes_qualidade_convencional WHERE trabalho_id=? AND peca_id=? AND resultado='REPROVADO' AND responsavel_id=? AND criado_em=? ORDER BY id DESC LIMIT 1), ?, ?, 'AGUARDANDO', ?, ?)`).bind(peca.trabalho_id,pecaId,peca.trabalho_id,pecaId,usuario.id,agora,setorRetorno,motivo,usuario.id,agora),
          env.db.prepare(`UPDATE etapas_convencionais SET status='BLOQUEADO', responsavel_id=?, iniciado_em=COALESCE(iniciado_em, ?), concluido_em=NULL WHERE id=?`).bind(usuario.id,agora,etapa.id),
          env.db.prepare(`UPDATE pecas_convencionais SET setor_atual=?, status='RETRABALHO' WHERE id=?`).bind(setorRetorno,pecaId)
        ]);}catch{return redirect(`/convencional/setor?setor=QUALIDADE&erro=`+encodeURIComponent("A peça mudou durante a reprovação. Nenhum retrabalho deste clique foi criado; atualize a página."));}
        await recalcularStatusTrabalhoConvencional(env, peca.trabalho_id);
        const arcada = peca.arcada === 'SUPERIOR' ? 'SUP' : 'INF';
        return redirect(`/convencional/setor?setor=QUALIDADE&ok=` + encodeURIComponent(`${peca.numero_articulador} ${arcada} · ${peca.paciente}: reprovada e enviada para ${nomeSetorConvencional(setorRetorno)}.`));
      }

      const rotaIniciarRetrabalho = caminho.match(/^\/convencional\/retrabalhos\/(\d+)\/iniciar$/);
      if (request.method === "POST" && rotaIniciarRetrabalho) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        const retrabalho = await obterRetrabalhoConvencional(env, Number(rotaIniciarRetrabalho[1]));
        if (!retrabalho) return textResponse("Retrabalho não encontrado.", 404);
        if (!podeOperarConvencional(usuario, retrabalho.setor_retorno)) return textResponse("Sem permissão para este retrabalho.", 403);
        if (retrabalho.status !== 'AGUARDANDO') return redirect(`/convencional/setor?setor=${encodeURIComponent(retrabalho.setor_retorno)}&erro=` + encodeURIComponent("Este retrabalho não está aguardando início."));
        const agora = new Date().toISOString();
        await env.db.batch([
          env.db.prepare(`UPDATE retrabalhos_convencionais SET status='EM_ANDAMENTO', responsavel_id=?, iniciado_em=? WHERE id=? AND status='AGUARDANDO'`).bind(usuario.id, agora, retrabalho.id),
          env.db.prepare(`UPDATE pecas_convencionais SET setor_atual=?, status='RETRABALHO' WHERE id=?`).bind(retrabalho.setor_retorno, retrabalho.peca_id)
        ]);
        await recalcularStatusTrabalhoConvencional(env, retrabalho.trabalho_id);
        return redirect(`/convencional/setor?setor=${encodeURIComponent(retrabalho.setor_retorno)}&ok=` + encodeURIComponent(`Retrabalho do articulador ${retrabalho.numero_articulador} iniciado.`));
      }

      const rotaConcluirRetrabalho = caminho.match(/^\/convencional\/retrabalhos\/(\d+)\/concluir$/);
      if (request.method === "POST" && rotaConcluirRetrabalho) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        const retrabalho = await obterRetrabalhoConvencional(env, Number(rotaConcluirRetrabalho[1]));
        if (!retrabalho) return textResponse("Retrabalho não encontrado.", 404);
        if (!podeOperarConvencional(usuario, retrabalho.setor_retorno)) return textResponse("Sem permissão para este retrabalho.", 403);
        if (retrabalho.status !== 'EM_ANDAMENTO') return redirect(`/convencional/setor?setor=${encodeURIComponent(retrabalho.setor_retorno)}&erro=` + encodeURIComponent("Inicie a correção antes de concluir."));
        if (!isCoord(usuario) && Number(retrabalho.responsavel_id) !== Number(usuario.id)) return textResponse("Este retrabalho está vinculado a outro funcionário.", 403);
        const agora = new Date().toISOString();
        const etapaQualidade = await env.db.prepare(`SELECT id FROM etapas_convencionais WHERE peca_id=? AND setor='QUALIDADE' LIMIT 1`).bind(retrabalho.peca_id).first();
        await env.db.batch([
          env.db.prepare(`UPDATE retrabalhos_convencionais SET status='CONCLUIDO', concluido_em=? WHERE id=? AND status='EM_ANDAMENTO'`).bind(agora, retrabalho.id),
          env.db.prepare(`UPDATE etapas_convencionais SET status='AGUARDANDO', responsavel_id=NULL, iniciado_em=NULL, concluido_em=NULL WHERE id=?`).bind(etapaQualidade.id),
          env.db.prepare(`UPDATE pecas_convencionais SET setor_atual='QUALIDADE', status='AGUARDANDO' WHERE id=?`).bind(retrabalho.peca_id)
        ]);
        await recalcularStatusTrabalhoConvencional(env, retrabalho.trabalho_id);
        const arcada = retrabalho.arcada === 'SUPERIOR' ? 'SUP' : 'INF';
        return redirect(`/convencional/setor?setor=${encodeURIComponent(retrabalho.setor_retorno)}&ok=` + encodeURIComponent(`Correção concluída: ${retrabalho.numero_articulador} ${arcada} voltou para a Qualidade.`));
      }

      const rotaIniciarConvencional = caminho.match(/^\/convencional\/etapas\/(\d+)\/iniciar$/);
      if (request.method === "POST" && rotaIniciarConvencional) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        const etapa = await obterEtapaConvencional(env, Number(rotaIniciarConvencional[1]));
        if (!etapa) return textResponse("Etapa não encontrada.", 404);
        if (SETORES_CONVENCIONAIS_ATIVOS.includes(etapa.setor)) return redirect(`/convencional/trabalhos/${etapa.trabalho_id}?erro=` + encodeURIComponent("Este setor agora é controlado pelo paciente inteiro, não por SUP/INF separadamente."));
        if (!podeOperarConvencional(usuario, etapa.setor)) return textResponse("Sem permissão para este setor.", 403);
        if (etapa.status !== "AGUARDANDO") return redirect(`/convencional/setor?setor=${encodeURIComponent(etapa.setor)}&erro=` + encodeURIComponent("A peça não está aguardando início."));
        const agora = new Date().toISOString();
        await env.db.prepare(`UPDATE etapas_convencionais SET status = 'EM_ANDAMENTO', responsavel_id = ?, iniciado_em = ? WHERE id = ? AND status = 'AGUARDANDO'`).bind(usuario.id, agora, etapa.id).run();
        await env.db.prepare(`UPDATE pecas_convencionais SET setor_atual = ?, status = 'EM_ANDAMENTO' WHERE id = ?`).bind(etapa.setor, etapa.peca_id).run();
        await recalcularStatusTrabalhoConvencional(env, etapa.trabalho_id);
        return redirect(`/convencional/setor?setor=${encodeURIComponent(etapa.setor)}&ok=` + encodeURIComponent(`${etapa.numero_articulador} ${etapa.arcada === "SUPERIOR" ? "SUP" : "INF"} iniciada.`));
      }

      const rotaConcluirConvencional = caminho.match(/^\/convencional\/etapas\/(\d+)\/concluir$/);
      if (request.method === "POST" && rotaConcluirConvencional) {
        const usuario = await obterUsuarioLogado(request, env);
        if (!usuario) return redirect("/");
        const etapa = await obterEtapaConvencional(env, Number(rotaConcluirConvencional[1]));
        if (!etapa) return textResponse("Etapa não encontrada.", 404);
        if (SETORES_CONVENCIONAIS_ATIVOS.includes(etapa.setor)) return redirect(`/convencional/trabalhos/${etapa.trabalho_id}?erro=` + encodeURIComponent("Este setor agora é controlado pelo paciente inteiro, não por SUP/INF separadamente."));
        if (!podeOperarConvencional(usuario, etapa.setor)) return textResponse("Sem permissão para este setor.", 403);
        if (etapa.status !== "EM_ANDAMENTO") return redirect(`/convencional/setor?setor=${encodeURIComponent(etapa.setor)}&erro=` + encodeURIComponent("Inicie a peça antes de concluir."));
        if (!isCoord(usuario) && Number(etapa.responsavel_id) !== Number(usuario.id)) return textResponse("Esta peça está vinculada a outro funcionário.", 403);
        const agora = new Date().toISOString();
        await env.db.prepare(`UPDATE etapas_convencionais SET status = 'CONCLUIDO', concluido_em = ? WHERE id = ? AND status = 'EM_ANDAMENTO'`).bind(agora, etapa.id).run();
        const proximo = proximoSetorConvencional(etapa.setor);
        if (proximo && SETORES_CONVENCIONAIS_V21.includes(proximo)) {
          await env.db.prepare(`UPDATE etapas_convencionais SET status = 'AGUARDANDO' WHERE peca_id = ? AND setor = ? AND status = 'BLOQUEADO'`).bind(etapa.peca_id, proximo).run();
          await env.db.prepare(`UPDATE pecas_convencionais SET setor_atual = ?, status = 'AGUARDANDO' WHERE id = ?`).bind(proximo, etapa.peca_id).run();
        } else {
          await env.db.prepare(`UPDATE pecas_convencionais SET setor_atual = 'INCLUSAO', status = 'AGUARDANDO' WHERE id = ?`).bind(etapa.peca_id).run();
        }
        await recalcularStatusTrabalhoConvencional(env, etapa.trabalho_id);
        return redirect(`/convencional/setor?setor=${encodeURIComponent(etapa.setor)}&ok=` + encodeURIComponent(`${etapa.numero_articulador} ${etapa.arcada === "SUPERIOR" ? "SUP" : "INF"} concluída. +1 peça na produção de ${nomeSetorConvencional(etapa.setor)}.`));
      }

  return null;
}
