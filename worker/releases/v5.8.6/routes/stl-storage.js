// FLUXO LAB V4.9.0 — ROTAS DE ARMAZENAMENTO STL
// Painel de armazenamento, conferência R2, upload/download, arquivamento, restauração e exclusão.
// Bloco original preservado: limites, permissões, histórico, auditoria e operações R2.

export async function handleStlStorageRoutesV49(request, env, url, caminho, metodo, deps) {
  const { cabecalhosSegurancaV30, formatarBytesV32, htmlResponse, isCoord, jsonResponseV32, listarStlLiberadosV32, nomeDownloadSeguroV32, obterArquivoStlV32, obterTrabalho, obterUsuarioLogado, paginaArmazenamentoStlV32, podeGerenciarAreaV31, redirect, registrarAuditoriaSistemaV31, registrarHistorico, resumoArmazenamentoStlV32, stlLiberadoExclusaoV32, textResponse, totalRealBucketV32, usuarioPodeVerTrabalhoDigitalV345, usuarioTemAreaDigital } = deps;

  /* V3.2 · ARMAZENAMENTO STL */
  if (caminho === "/armazenamento-stl" && metodo === "GET") {
    const usuario = await obterUsuarioLogado(request, env);
    if (!usuario) return redirect("/");
    if (!podeGerenciarAreaV31(usuario, "DIGITAL")) return textResponse("Acesso negado ao armazenamento STL.", 403);
    const resumo = await resumoArmazenamentoStlV32(env);
    const liberados = await listarStlLiberadosV32(env);
    return htmlResponse(paginaArmazenamentoStlV32(usuario, resumo, liberados, null, url.searchParams.get("ok") || url.searchParams.get("erro") || "", url.searchParams.get("erro") ? "erro" : "sucesso"));
  }

  if (caminho === "/armazenamento-stl/recalcular" && metodo === "POST") {
    const usuario = await obterUsuarioLogado(request, env);
    if (!usuario) return redirect("/");
    if (!podeGerenciarAreaV31(usuario, "DIGITAL")) return textResponse("Acesso negado.", 403);
    if (!env.STL_BUCKET) return textResponse("Binding STL_BUCKET não configurado.", 500);
    const [resumo, liberados, real] = await Promise.all([
      resumoArmazenamentoStlV32(env),
      listarStlLiberadosV32(env),
      totalRealBucketV32(env.STL_BUCKET)
    ]);
    return htmlResponse(paginaArmazenamentoStlV32(usuario, resumo, liberados, real, "Conferência do R2 concluída.", "sucesso"));
  }

  let matchStlV32 = caminho.match(/^\/trabalhos\/(\d+)\/stl\/upload$/);
  if (matchStlV32 && metodo === "POST") {
    const usuario = await obterUsuarioLogado(request, env);
    if (!usuario) return jsonResponseV32({ mensagem: "Sessão expirada." }, 401);
    if (!usuarioTemAreaDigital(usuario)) return jsonResponseV32({ mensagem: "Acesso negado à Área Digital." }, 403);
    if (!env.STL_BUCKET) return jsonResponseV32({ mensagem: "Armazenamento R2 não configurado." }, 500);

    const trabalhoId = Number(matchStlV32[1]);
    const trabalho = await obterTrabalho(env, trabalhoId);
    if (!trabalho || !(await usuarioPodeVerTrabalhoDigitalV345(env, usuario, trabalhoId))) return jsonResponseV32({ mensagem: "Paciente/trabalho não encontrado." }, 404);
    if (Number(trabalho.entregue || 0) === 1) return jsonResponseV32({ mensagem: "Upload bloqueado: a entrega deste trabalho já foi registrada." }, 409);

    const nome = nomeDownloadSeguroV32(url.searchParams.get("nome") || "");
    const tamanhoInformado = Number(url.searchParams.get("tamanho") || 0);
    const arcada = String(url.searchParams.get("arcada") || "").toUpperCase();
    const categoria = String(url.searchParams.get("categoria") || "").toUpperCase();
    const arcadas = ["SUPERIOR","INFERIOR","AMBAS","NAO_APLICAVEL"];
    const categorias = ["BASE","DENTES","GENGIVA","PPR_FLEX","PROJETO","OUTRO"];
    if (!nome.toLowerCase().endsWith(".stl")) return jsonResponseV32({ mensagem: "Somente arquivos .stl são permitidos." }, 400);
    if (!arcadas.includes(arcada) || !categorias.includes(categoria)) return jsonResponseV32({ mensagem: "Arcada ou categoria inválida." }, 400);

    const resumoAntes = await resumoArmazenamentoStlV32(env);
    if (!Number.isFinite(tamanhoInformado) || tamanhoInformado <= 0 || tamanhoInformado > resumoAntes.limite_arquivo_bytes) {
      return jsonResponseV32({ mensagem: `Arquivo inválido ou maior que ${formatarBytesV32(resumoAntes.limite_arquivo_bytes)}.` }, 413);
    }
    if (resumoAntes.usado_bytes >= resumoAntes.limite_bytes || resumoAntes.usado_bytes + tamanhoInformado > resumoAntes.limite_bytes) {
      return jsonResponseV32({ mensagem: `Upload bloqueado: o arquivo ultrapassaria o limite interno de ${formatarBytesV32(resumoAntes.limite_bytes)}.` }, 409);
    }
    if (!request.body) return jsonResponseV32({ mensagem: "Arquivo vazio." }, 400);

    const chave = `digital/remessa-${Number(trabalho.remessa_id || 0) || "sem-remessa"}/trabalho-${trabalhoId}/${crypto.randomUUID()}.stl`;
    let objeto = null;
    try {
      objeto = await env.STL_BUCKET.put(chave, request.body, {
        httpMetadata: { contentType: "model/stl" },
        customMetadata: { trabalhoId: String(trabalhoId), enviadoPor: String(usuario.id) }
      });
      const tamanhoReal = Number(objeto?.size || tamanhoInformado);
      if (tamanhoReal <= 0 || tamanhoReal > resumoAntes.limite_arquivo_bytes || resumoAntes.usado_bytes + tamanhoReal > resumoAntes.limite_bytes) {
        await env.STL_BUCKET.delete(chave);
        return jsonResponseV32({ mensagem: "Upload cancelado após validação do tamanho real do arquivo." }, 409);
      }

      const versaoRow = await env.db.prepare(`SELECT COALESCE(MAX(versao),0) AS maior FROM arquivos_stl WHERE trabalho_id=? AND lower(nome_original)=lower(?)`).bind(trabalhoId, nome).first();
      const versao = Number(versaoRow?.maior || 0) + 1;
      const inserido = await env.db.prepare(`
        INSERT INTO arquivos_stl
          (trabalho_id,remessa_id,nome_original,nome_exibicao,chave_r2,tamanho_bytes,mime_type,arcada,categoria,versao,status,enviado_por,enviado_em)
        VALUES (?,?,?,?,?,?,?,?,?,?,'ATIVO',?,CURRENT_TIMESTAMP)
      `).bind(trabalhoId, trabalho.remessa_id || null, nome, nome, chave, tamanhoReal, "model/stl", arcada, categoria, versao, usuario.id).run();
      const arquivoId = Number(inserido.meta.last_row_id || 0);
      await registrarHistorico(env, trabalhoId, usuario.id, "STL_ENVIADO", `${nome} · ${formatarBytesV32(tamanhoReal)} · v${versao}`);
      await registrarAuditoriaSistemaV31(env, usuario.id, "DIGITAL", "UPLOAD_STL", "ARQUIVO_STL", arquivoId, "tamanho_bytes", null, tamanhoReal, `Trabalho ${trabalho.codigo}`);
      return jsonResponseV32({ mensagem: `${nome} enviado com sucesso (${formatarBytesV32(tamanhoReal)}).`, arquivo_id: arquivoId }, 201);
    } catch (erro) {
      if (objeto) {
        try { await env.STL_BUCKET.delete(chave); } catch (_) {}
      }
      return jsonResponseV32({ mensagem: "Não foi possível concluir o upload STL. Nenhum registro foi mantido." }, 500);
    }
  }

  matchStlV32 = caminho.match(/^\/stl\/(\d+)\/download$/);
  if (matchStlV32 && metodo === "GET") {
    const usuario = await obterUsuarioLogado(request, env);
    if (!usuario) return redirect("/");
    if (!usuarioTemAreaDigital(usuario)) return textResponse("Acesso negado à Área Digital.", 403);
    if (!env.STL_BUCKET) return textResponse("Binding STL_BUCKET não configurado.", 500);
    const arquivo = await obterArquivoStlV32(env, Number(matchStlV32[1]));
    if (!arquivo || arquivo.status === "EXCLUIDO") return textResponse("Arquivo STL não disponível.", 404);
    const objeto = await env.STL_BUCKET.get(arquivo.chave_r2);
    if (!objeto) return textResponse("Arquivo físico não encontrado no R2. Procure a coordenação.", 404);
    const headers = new Headers(cabecalhosSegurancaV30("model/stl"));
    objeto.writeHttpMetadata(headers);
    const nome = nomeDownloadSeguroV32(arquivo.nome_exibicao || arquivo.nome_original);
    headers.set("Content-Disposition", `attachment; filename="arquivo.stl"; filename*=UTF-8''${encodeURIComponent(nome)}`);
    headers.set("Content-Length", String(objeto.size || arquivo.tamanho_bytes || ""));
    return new Response(objeto.body, { status: 200, headers });
  }

  matchStlV32 = caminho.match(/^\/stl\/(\d+)\/arquivar$/);
  if (matchStlV32 && metodo === "POST") {
    const usuario = await obterUsuarioLogado(request, env);
    if (!usuario) return redirect("/");
    if (!podeGerenciarAreaV31(usuario, "DIGITAL")) return textResponse("Acesso negado.", 403);
    const arquivo = await obterArquivoStlV32(env, Number(matchStlV32[1]));
    if (!arquivo || arquivo.status !== "ATIVO") return textResponse("Arquivo não disponível para arquivamento.", 404);
    if (!stlLiberadoExclusaoV32(arquivo)) return redirect(`/trabalhos/${arquivo.trabalho_id}?erro=${encodeURIComponent("Arquivamento bloqueado até a entrega ser registrada.")}`);
    const form = await request.formData();
    const motivo = String(form.get("motivo") || "").trim();
    if (motivo.length < 3) return redirect(`/trabalhos/${arquivo.trabalho_id}?erro=${encodeURIComponent("Informe o motivo do arquivamento.")}`);
    await env.db.prepare(`UPDATE arquivos_stl SET status='ARQUIVADO',arquivado_por=?,arquivado_em=CURRENT_TIMESTAMP,motivo_arquivamento=? WHERE id=?`).bind(usuario.id, motivo, arquivo.id).run();
    await registrarAuditoriaSistemaV31(env, usuario.id, "DIGITAL", "ARQUIVAR_STL", "ARQUIVO_STL", arquivo.id, "status", "ATIVO", "ARQUIVADO", motivo);
    return redirect(`/trabalhos/${arquivo.trabalho_id}?ok=${encodeURIComponent("STL arquivado. Ele continua ocupando espaço no R2.")}`);
  }

  matchStlV32 = caminho.match(/^\/stl\/(\d+)\/restaurar$/);
  if (matchStlV32 && metodo === "POST") {
    const usuario = await obterUsuarioLogado(request, env);
    if (!usuario) return redirect("/");
    if (!podeGerenciarAreaV31(usuario, "DIGITAL")) return textResponse("Acesso negado.", 403);
    const arquivo = await obterArquivoStlV32(env, Number(matchStlV32[1]));
    if (!arquivo || arquivo.status !== "ARQUIVADO") return textResponse("Arquivo não arquivado.", 404);
    await env.db.prepare(`UPDATE arquivos_stl SET status='ATIVO',arquivado_por=NULL,arquivado_em=NULL,motivo_arquivamento=NULL WHERE id=?`).bind(arquivo.id).run();
    await registrarAuditoriaSistemaV31(env, usuario.id, "DIGITAL", "RESTAURAR_STL", "ARQUIVO_STL", arquivo.id, "status", "ARQUIVADO", "ATIVO", null);
    return redirect(`/trabalhos/${arquivo.trabalho_id}?ok=${encodeURIComponent("STL restaurado para ativo.")}`);
  }

  matchStlV32 = caminho.match(/^\/stl\/(\d+)\/excluir$/);
  if (matchStlV32 && metodo === "POST") {
    const usuario = await obterUsuarioLogado(request, env);
    if (!usuario) return redirect("/");
    if (!isCoord(usuario)) return textResponse("Somente Administrador ou Coordenador pode excluir STL definitivamente.", 403);
    if (!env.STL_BUCKET) return textResponse("Binding STL_BUCKET não configurado.", 500);
    const arquivo = await obterArquivoStlV32(env, Number(matchStlV32[1]));
    if (!arquivo || arquivo.status === "EXCLUIDO") return textResponse("Arquivo STL não disponível.", 404);
    if (!stlLiberadoExclusaoV32(arquivo)) return redirect(`/trabalhos/${arquivo.trabalho_id}?erro=${encodeURIComponent("Exclusão bloqueada: a entrega ainda não foi registrada.")}`);
    const form = await request.formData();
    const motivo = String(form.get("motivo") || "").trim();
    if (motivo.length < 5) return redirect(`/trabalhos/${arquivo.trabalho_id}?erro=${encodeURIComponent("Informe um motivo para a exclusão definitiva.")}`);
    try {
      await env.STL_BUCKET.delete(arquivo.chave_r2);
      await env.db.prepare(`UPDATE arquivos_stl SET status='EXCLUIDO',excluido_por=?,excluido_em=CURRENT_TIMESTAMP,motivo_exclusao=? WHERE id=?`).bind(usuario.id, motivo, arquivo.id).run();
      await registrarHistorico(env, arquivo.trabalho_id, usuario.id, "STL_EXCLUIDO", `${arquivo.nome_original} · ${formatarBytesV32(arquivo.tamanho_bytes)} · motivo: ${motivo}`);
      await registrarAuditoriaSistemaV31(env, usuario.id, "DIGITAL", "EXCLUIR_STL_R2", "ARQUIVO_STL", arquivo.id, "status", arquivo.status, "EXCLUIDO", motivo);
      return redirect(`/trabalhos/${arquivo.trabalho_id}?ok=${encodeURIComponent(`STL excluído do R2. ${formatarBytesV32(arquivo.tamanho_bytes)} liberados do limite interno.`)}`);
    } catch (erro) {
      return redirect(`/trabalhos/${arquivo.trabalho_id}?erro=${encodeURIComponent("Falha ao excluir o arquivo físico do R2. O registro não foi marcado como excluído.")}`);
    }
  }


  return null;
}
