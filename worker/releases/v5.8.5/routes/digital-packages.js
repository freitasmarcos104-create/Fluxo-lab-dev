// FLUXO LAB V4.9.0 — ROTAS DE ARQUIVOS E PACOTES DIGITAIS
// Upload de arquivos soltos e pastas, multipart, downloads, ZIP, confirmação, cancelamento e exclusão.
// Bloco original preservado: limites, validações, permissões, SQL, eventos e operações R2.

export async function handleDigitalPackageRoutesV49(request, env, url, caminho, metodo, deps) {
  const { PACOTE_EXTENSOES_V321, anexarMensagemV3171, avisoPrioridadeV315, cabecalhosSegurancaV30, caminhoRelativoSeguroV321, confirmarRecebimentoPacoteV344, deletarChavesR2V321, extensaoArquivoV321, formatarBytesV32, formularioEnvioV315, htmlResponse, jsonResponseV32, listarArquivosPacoteV321, listarEntregasV315, listarPacotesTrabalhoV321, listarPacotesVisiveisV321, mimeArquivoV321, nomePacoteSeguroV321, obterPacoteV321, obterTrabalho, obterUsuarioLogado, paginaCaixaArquivosV321, paginaPacotesTrabalhoV321, pendentesImpressaoV315, podeGerenciarAreaV31, redirect, registrarAuditoriaSistemaV31, registrarEventoPacoteV321, respostaZipPacoteV321, resumoArmazenamentoStlV32, rotuloTipoArquivoV315, setoresDigitaisUsuarioV321, textResponse, urlBasePacoteV3171, usuarioPodeAcessarPacoteV3171, usuarioPodeAcessarUploadPacoteV3171, usuarioPodeCriarFluxoV321, usuarioPodeExcluirPacoteV321, usuarioPodeVerPacoteV321, usuarioPodeVerTrabalhoDigitalV345, usuarioTemAreaDigital, voltarSeguroV3171 } = deps;

  /* V3.15.0 — ENVIO DE ARQUIVO SOLTO, DOWNLOAD E LIMPEZA */
  if (metodo === "POST" && caminho === "/arquivos-digitais/soltos") {
    const usuario = await obterUsuarioLogado(request, env);
    if (!usuario) return jsonResponseV32({mensagem:"Sessão expirada."},401);
    if (!usuarioTemAreaDigital(usuario)) return jsonResponseV32({mensagem:"Acesso negado."},403);
    if (!env.STL_BUCKET) return jsonResponseV32({mensagem:"Binding STL_BUCKET não configurado."},500);
    let body; try{body=await request.json();}catch(_){return jsonResponseV32({mensagem:"Dados inválidos."},400);}
    const tipo=String(body?.tipo||"").toUpperCase();
    const TIPOS=["STL_PROJETO","GOO_FATIADO","RESULTADO_CAD","OUTROS"];
    if(!TIPOS.includes(tipo)) return jsonResponseV32({mensagem:"Escolha o tipo do arquivo."},400);
    const origem=String(body?.setor_origem||"").toUpperCase();
    let destino=String(body?.setor_destino||"").toUpperCase();
    const S=["CAD/CAM","FATIAMENTO","IMPRESSAO","ACABAMENTO"];
    if(!S.includes(origem)) return jsonResponseV32({mensagem:"Setor de origem inválido."},400);
    if(tipo==="GOO_FATIADO"){ destino="IMPRESSAO"; if(origem==="IMPRESSAO") return jsonResponseV32({mensagem:"O GOO sai do Fatiamento para a Impressão."},400); }
    else if(tipo==="STL_PROJETO"||tipo==="RESULTADO_CAD"){ if(!["CAD/CAM","FATIAMENTO"].includes(destino)) return jsonResponseV32({mensagem:"STL vai entre CAD/CAM e Fatiamento."},400); }
    else { if(!S.includes(destino)||destino===origem) return jsonResponseV32({mensagem:"Escolha um destino diferente da origem."},400); }
    const vinculado=["STL_PROJETO","RESULTADO_CAD"].includes(tipo);
    let trabalhoId=Number(body?.trabalho_id||0);
    const pacienteLivre=String(body?.paciente_livre||"").trim().slice(0,120);
    if(vinculado&&!(Number.isSafeInteger(trabalhoId)&&trabalhoId>0)&&!pacienteLivre) return jsonResponseV32({mensagem:"Busque e escolha o paciente, ou escreva o nome do paciente sem cadastro."},400);
    if(Number.isSafeInteger(trabalhoId)&&trabalhoId>0){ const t=await obterTrabalho(env,trabalhoId); if(!t||Number(t.excluido||0)) return jsonResponseV32({mensagem:"Paciente não encontrado."},404); }
    else trabalhoId=0;
    const recebidos=Array.isArray(body?.arquivos)?body.arquivos:[];
    if(!recebidos.length) return jsonResponseV32({mensagem:"Nenhum arquivo recebido."},400);
    const observacao=String(body?.observacao||"").trim().slice(0,500)||null;
    const pastaNome=String(body?.pasta_nome||"").trim().slice(0,120);
    const nomePacote=(pastaNome || String(body?.nome_pacote||("Entrega "+rotuloTipoArquivoV315(tipo)))).trim().slice(0,120)||"Entrega de arquivos";
    const resumo=await resumoArmazenamentoStlV32(env);
    let total=0; const lista=[];
    for(let i=0;i<recebidos.length;i++){
      const x=recebidos[i]||{},nomeArq=String(x.nome||"").trim().slice(0,180),ext=extensaoArquivoV321(nomeArq),tam=Number(x.tamanho||0);
      if(!PACOTE_EXTENSOES_V321.has(ext)) return jsonResponseV32({mensagem:`Arquivo não permitido: ${nomeArq||"sem nome"}.`},400);
      if(!Number.isSafeInteger(tam)||tam<=0) return jsonResponseV32({mensagem:`Tamanho inválido: ${nomeArq}.`},400);
      lista.push({indice:i,nome:nomeArq,caminho:caminhoRelativoSeguroV321(x.caminho||nomeArq,nomeArq),tamanho:tam,ext,mime:mimeArquivoV321(nomeArq,x.mime)}); total+=tam;
    }
    if(total>resumo.limite_bytes || resumo.usado_bytes+total>resumo.limite_bytes) return jsonResponseV32({mensagem:`Espaço insuficiente. Disponível: ${formatarBytesV32(resumo.disponivel_bytes)}. Apague arquivos já baixados para liberar espaço.`},409);
    let pacoteId=0;
    try{
      const agora=new Date().toISOString();
      if(destino === origem) return jsonResponseV32({mensagem:"O setor de destino tem que ser diferente do setor de origem. Para STL, escolha CAD/CAM -> Fatiamento ou Fatiamento -> CAD/CAM."},400);
      const rp=await env.db.prepare(`INSERT INTO pacotes_arquivos_digitais (trabalho_id,remessa_id,nome_pacote,setor_origem,setor_destino,observacao,status,criado_por) VALUES (?,?,?,?,?,?,'ATIVO',?)`).bind(trabalhoId||null,null,nomePacote,origem,destino,observacao,usuario.id).run();
      pacoteId=Number(rp.meta.last_row_id||0);
      if(!pacoteId) return jsonResponseV32({mensagem:"Nao foi possivel criar a entrega."},500);
      if(pacienteLivre && !trabalhoId) {
        // V3.17.1: o nome sem cadastro fica só na observação da entrega (não cria "paciente" fantasma em trabalhos).
        await env.db.prepare(`UPDATE pacotes_arquivos_digitais SET observacao=? WHERE id=?`).bind((`Paciente (sem cadastro): ${pacienteLivre}`+(observacao?` · ${observacao}`:"")).slice(0,500),pacoteId).run();
      }
      const saida=[];
      for(const a of lista){
        const chave=`digital/pacotes/trabalho-${trabalhoId||0}/pacote-${pacoteId}/${crypto.randomUUID()}${a.ext}`;
        const ra=await env.db.prepare(`INSERT INTO arquivos_pacotes_digitais (pacote_id,nome_original,caminho_relativo,extensao,mime_type,tamanho_bytes,chave_r2,status,enviado_por) VALUES (?,?,?,?,?,?,?,'PENDENTE',?)`).bind(pacoteId,a.nome,a.caminho,a.ext,a.mime,a.tamanho,chave,usuario.id).run();
        saida.push({indice:a.indice,id:Number(ra.meta.last_row_id||0),caminho:a.caminho,tamanho:a.tamanho,pacote_id:pacoteId});
      }
      return jsonResponseV32({ok:true,pacote_id:pacoteId,setor_origem:origem,setor_destino:destino,tipo,arquivos:saida});
    }catch(erro){
      return jsonResponseV32({mensagem:"Não foi possível registrar a entrega: "+String(erro?.message||erro)},500);
    }
  }

    if (metodo === "POST" && caminho === "/arquivos-digitais/marcar-baixado") {
    const usuario = await obterUsuarioLogado(request, env);
    if (!usuario) return redirect("/");
    if (!usuarioTemAreaDigital(usuario)) return textResponse("Acesso negado à Área Digital.", 403);
    const form = await request.formData();
    const id = Number(form.get("arquivo_id"));
    const voltar = voltarSeguroV3171(form.get("voltar"));
    if (!Number.isSafeInteger(id) || id <= 0) return redirect(voltar);
    const arq = await env.db.prepare(`SELECT id, pacote_id FROM arquivos_pacotes_digitais WHERE id = ? AND status = 'ATIVO' LIMIT 1`).bind(id).first();
    if (!arq) return redirect(anexarMensagemV3171(voltar, "erro", "Arquivo não encontrado."));
    const pacote = await obterPacoteV321(env, Number(arq.pacote_id), usuario.id);
    if (!pacote || !(await usuarioPodeAcessarPacoteV3171(env, usuario, pacote))) return textResponse("Acesso negado.", 403);
    try {
      await env.db.prepare(`UPDATE arquivos_pacotes_digitais SET baixado_em = COALESCE(baixado_em, ?), baixado_por = COALESCE(baixado_por, ?) WHERE id = ?`).bind(new Date().toISOString(), usuario.id, id).run();
    } catch (erro) { if (!/no such column/i.test(String(erro?.message||erro))) throw erro; }
    return redirect(voltar);
  }

  if (metodo === "POST" && caminho === "/arquivos-digitais/apagar") {
    const usuario = await obterUsuarioLogado(request, env);
    if (!usuario) return redirect("/");
    if (!usuarioTemAreaDigital(usuario)) return textResponse("Acesso negado à Área Digital.", 403);
    const form = await request.formData();
    const id = Number(form.get("arquivo_id"));
    const voltar = voltarSeguroV3171(form.get("voltar"));
    if (!Number.isSafeInteger(id) || id <= 0) return redirect(voltar);
    const arq = await env.db.prepare(`SELECT * FROM arquivos_pacotes_digitais WHERE id = ?`).bind(id).first();
    if (!arq) return redirect(anexarMensagemV3171(voltar, "erro", "Arquivo não encontrado."));
    if (String(arq.status) === "EXCLUIDO") return redirect(anexarMensagemV3171(voltar, "erro", "Esse arquivo já foi apagado."));
    const pacote = await obterPacoteV321(env, Number(arq.pacote_id), usuario.id);
    if (!pacote || !(await usuarioPodeAcessarPacoteV3171(env, usuario, pacote))) return textResponse("Acesso negado.", 403);
    const podeApagar = podeGerenciarAreaV31(usuario, "DIGITAL")
      || setoresDigitaisUsuarioV321(usuario).includes(String(pacote.setor_destino))
      || Number(arq.enviado_por || 0) === Number(usuario.id);
    if (!podeApagar) return redirect(anexarMensagemV3171(voltar, "erro", "Somente a gestão, o setor de destino ou quem enviou pode apagar este arquivo."));
    let baixado = arq.baixado_em || null;
    if (!baixado) {
      try { const d = await env.db.prepare(`SELECT 1 AS ok FROM downloads_pacotes_digitais WHERE pacote_id = ? AND tipo_download = 'PACOTE_COMPLETO' LIMIT 1`).bind(arq.pacote_id).first(); if (d) baixado = new Date().toISOString(); } catch (_) {}
    }
    if (!baixado) return redirect(anexarMensagemV3171(voltar, "erro", "Só dá para apagar um arquivo depois que alguém baixar."));
    if (env.STL_BUCKET && arq.chave_r2) {
      try { await env.STL_BUCKET.delete(String(arq.chave_r2)); }
      catch (erroR2) { return redirect(anexarMensagemV3171(voltar, "erro", "Falha ao apagar o arquivo físico no R2. Nada foi marcado como apagado.")); }
    }
    await env.db.prepare(`UPDATE arquivos_pacotes_digitais SET status='EXCLUIDO', excluido_em=?, excluido_por=? WHERE id = ?`).bind(new Date().toISOString(), usuario.id, id).run();
    try { await registrarEventoPacoteV321(env, arq.pacote_id, usuario.id, "EXCLUSAO_INICIADA", 1, Number(arq.tamanho_bytes||0), arq.caminho_relativo); } catch (_) {}
    return redirect(anexarMensagemV3171(voltar, "ok", "Arquivo apagado. O espaço foi liberado."));
  }


  if (metodo === "GET" && caminho === "/arquivos-digitais") {
    const usuario=await obterUsuarioLogado(request,env); if(!usuario) return redirect("/");
    if(!usuarioTemAreaDigital(usuario)) return textResponse("Acesso negado à Área Digital.",403);
    const pacotes=await listarPacotesVisiveisV321(env,usuario);
    return htmlResponse(paginaCaixaArquivosV321(usuario,pacotes,url.searchParams.get("ok")||url.searchParams.get("erro")||"",url.searchParams.get("erro")?"erro":"sucesso",avisoPrioridadeV315(await pendentesImpressaoV315(env)),usuarioTemAreaDigital(usuario)?formularioEnvioV315(usuario, [], "/arquivos-digitais"):"",(await listarEntregasV315(env)).filter(a=>!a.trabalho_id||usuarioPodeVerPacoteV321(usuario,a))));
  }

  let matchPacoteV321=caminho.match(/^\/trabalhos\/(\d+)\/pacotes$/);
  if(matchPacoteV321 && metodo==="GET"){
    const usuario=await obterUsuarioLogado(request,env); if(!usuario) return redirect("/");
    if(!usuarioTemAreaDigital(usuario)) return textResponse("Acesso negado à Área Digital.",403);
    const trabalhoId=Number(matchPacoteV321[1]); const trabalho=await obterTrabalho(env,trabalhoId);
    if(!trabalho || !(await usuarioPodeVerTrabalhoDigitalV345(env,usuario,trabalhoId))) return textResponse("Trabalho não encontrado.",404);
    const pacotes=await listarPacotesTrabalhoV321(env,trabalhoId,usuario.id);
    const arquivosPorPacote=new Map();
    await Promise.all(pacotes.map(async p=>arquivosPorPacote.set(Number(p.id),await listarArquivosPacoteV321(env,p.id,true))));
    return htmlResponse(paginaPacotesTrabalhoV321(usuario,trabalho,pacotes,arquivosPorPacote,await resumoArmazenamentoStlV32(env),url.searchParams.get("ok")||url.searchParams.get("erro")||"",url.searchParams.get("erro")?"erro":"sucesso"));
  }

  matchPacoteV321=caminho.match(/^\/trabalhos\/(\d+)\/pacotes\/criar$/);
  if(matchPacoteV321 && metodo==="POST"){
    const usuario=await obterUsuarioLogado(request,env); if(!usuario) return jsonResponseV32({mensagem:"Sessão expirada."},401);
    if(!usuarioTemAreaDigital(usuario)) return jsonResponseV32({mensagem:"Acesso negado."},403);
    if(!env.STL_BUCKET) return jsonResponseV32({mensagem:"Binding STL_BUCKET não configurado."},500);
    const trabalhoId=Number(matchPacoteV321[1]); const trabalho=await obterTrabalho(env,trabalhoId);
    if(!trabalho||Number(trabalho.excluido||0)||!(await usuarioPodeVerTrabalhoDigitalV345(env,usuario,trabalhoId))) return jsonResponseV32({mensagem:"Trabalho não encontrado."},404);
    if(Number(trabalho.entregue||0)===1) return jsonResponseV32({mensagem:"Trabalho já entregue. Novos pacotes estão bloqueados."},400);
    let body; try{body=await request.json();}catch(_){return jsonResponseV32({mensagem:"Dados do pacote inválidos."},400);}
    const origem=String(body?.setor_origem||"").toUpperCase(),destino=String(body?.setor_destino||"").toUpperCase();
    if(!usuarioPodeCriarFluxoV321(usuario,origem,destino)) return jsonResponseV32({mensagem:"Você não pode criar esse fluxo de arquivos."},403);
    const nome=nomePacoteSeguroV321(body?.nome_pacote||"Pacote de arquivos");
    const observacao=String(body?.observacao||"").trim().slice(0,500)||null;
    const recebidos=Array.isArray(body?.arquivos)?body.arquivos:[];
    if(!recebidos.length) return jsonResponseV32({mensagem:"A pasta não contém arquivos."},400);
    const arquivos=[]; let total=0;
    for(let i=0;i<recebidos.length;i++){
      const x=recebidos[i]||{},nomeArq=String(x.nome||"").trim().slice(0,180),ext=extensaoArquivoV321(nomeArq),tam=Number(x.tamanho||0);
      if(!PACOTE_EXTENSOES_V321.has(ext)) return jsonResponseV32({mensagem:`Arquivo não permitido: ${nomeArq||"sem nome"}. Use STL ou OBJ.`},400);
      if(!Number.isSafeInteger(tam)||tam<=0) return jsonResponseV32({mensagem:`Tamanho inválido: ${nomeArq}.`},400);
      const caminhoSeguro=caminhoRelativoSeguroV321(x.caminho||nomeArq,nomeArq);
      arquivos.push({indice:Number.isInteger(Number(x.indice))?Number(x.indice):i,nome:nomeArq,caminho:caminhoSeguro,tamanho:tam,ext,mime:mimeArquivoV321(nomeArq,x.mime)}); total+=tam;
      if(!Number.isSafeInteger(total)) return jsonResponseV32({mensagem:"Pasta grande demais para contabilização segura."},400);
    }
    const resumo=await resumoArmazenamentoStlV32(env);
    if(total>resumo.limite_bytes || resumo.usado_bytes+total>resumo.limite_bytes) return jsonResponseV32({mensagem:`Upload bloqueado: a pasta de ${formatarBytesV32(total)} ultrapassaria o limite interno de ${formatarBytesV32(resumo.limite_bytes)}. Disponível: ${formatarBytesV32(resumo.disponivel_bytes)}.`},409);
    let pacoteId=0;
    try{
      const rp=await env.db.prepare(`INSERT INTO pacotes_arquivos_digitais (trabalho_id,remessa_id,nome_pacote,setor_origem,setor_destino,observacao,status,criado_por) VALUES (?,?,?,?,?,?,'ATIVO',?)`).bind(trabalhoId,trabalho.remessa_id||null,nome,origem,destino,observacao,usuario.id).run();
      pacoteId=Number(rp.meta.last_row_id||0); const saida=[];
      for(const a of arquivos){
        const chave=`digital/pacotes/trabalho-${trabalhoId}/pacote-${pacoteId}/${crypto.randomUUID()}${a.ext}`;
        const ra=await env.db.prepare(`INSERT INTO arquivos_pacotes_digitais (pacote_id,nome_original,caminho_relativo,extensao,mime_type,tamanho_bytes,chave_r2,status,enviado_por) VALUES (?,?,?,?,?,?,?,'PENDENTE',?)`).bind(pacoteId,a.nome,a.caminho,a.ext,a.mime,a.tamanho,chave,usuario.id).run();
        saida.push({indice:a.indice,id:Number(ra.meta.last_row_id||0),caminho:a.caminho,tamanho:a.tamanho});
      }
      const depois=await resumoArmazenamentoStlV32(env);
      if(depois.usado_bytes>depois.limite_bytes){
        await env.db.prepare(`UPDATE pacotes_arquivos_digitais SET status='CANCELADO',excluido_por=?,excluido_em=CURRENT_TIMESTAMP,motivo_exclusao='Reserva excedeu limite interno por concorrência.' WHERE id=?`).bind(usuario.id,pacoteId).run();
        await env.db.prepare(`UPDATE arquivos_pacotes_digitais SET status='EXCLUIDO',excluido_por=?,excluido_em=CURRENT_TIMESTAMP,motivo_exclusao='Reserva excedeu limite interno por concorrência.' WHERE pacote_id=?`).bind(usuario.id,pacoteId).run();
        return jsonResponseV32({mensagem:"Outro upload ocupou o espaço disponível. Tente novamente após liberar armazenamento."},409);
      }
      await registrarEventoPacoteV321(env,pacoteId,usuario.id,"PACOTE_CRIADO",arquivos.length,total,`${origem} → ${destino}`);
      await registrarEventoPacoteV321(env,pacoteId,usuario.id,"UPLOAD_INICIADO",arquivos.length,total,"Upload multipart iniciado.");
      await registrarAuditoriaSistemaV31(env,usuario.id,"DIGITAL","CRIAR_PACOTE_ARQUIVOS","PACOTE_DIGITAL",pacoteId,"setor_destino",null,destino,`${arquivos.length} arquivo(s), ${total} bytes`);
      return jsonResponseV32({pacote_id:pacoteId,arquivos:saida,mensagem:"Pacote preparado."});
    }catch(err){
      if(pacoteId){
        try{
          const motivoFalha=String(err?.message||"Falha ao preparar upload").slice(0,300);
          await env.db.prepare(`UPDATE pacotes_arquivos_digitais SET status='CANCELADO',excluido_por=?,excluido_em=CURRENT_TIMESTAMP,motivo_exclusao=? WHERE id=?`).bind(usuario.id,motivoFalha,pacoteId).run();
          await env.db.prepare(`UPDATE arquivos_pacotes_digitais SET status='EXCLUIDO',excluido_por=?,excluido_em=CURRENT_TIMESTAMP,motivo_exclusao=? WHERE pacote_id=? AND status!='EXCLUIDO'`).bind(usuario.id,motivoFalha,pacoteId).run();
        }catch(_){ }
      }
      return jsonResponseV32({mensagem:"Falha ao preparar o pacote para upload."},500);
    }
  }

  matchPacoteV321=caminho.match(/^\/pacotes\/(\d+)\/arquivos\/(\d+)\/mpu\/criar$/);
  if(matchPacoteV321 && metodo==="POST"){
    const usuario=await obterUsuarioLogado(request,env); if(!usuario) return jsonResponseV32({mensagem:"Sessão expirada."},401);
    if(!env.STL_BUCKET) return jsonResponseV32({mensagem:"R2 indisponível."},500);
    const pacote=await obterPacoteV321(env,Number(matchPacoteV321[1]),usuario.id); if(!pacote||!(await usuarioPodeAcessarUploadPacoteV3171(env,usuario,pacote))) return jsonResponseV32({mensagem:"Acesso negado ao upload."},403);
    const arquivo=await env.db.prepare(`SELECT * FROM arquivos_pacotes_digitais WHERE id=? AND pacote_id=? LIMIT 1`).bind(Number(matchPacoteV321[2]),pacote.id).first();
    if(!arquivo||arquivo.status!=="PENDENTE") return jsonResponseV32({mensagem:"Arquivo não está pendente para upload."},400);
    try{const up=await env.STL_BUCKET.createMultipartUpload(arquivo.chave_r2,{httpMetadata:{contentType:arquivo.mime_type||"application/octet-stream"},customMetadata:{pacote:String(pacote.id),trabalho:String(pacote.trabalho_id)}});return jsonResponseV32({uploadId:up.uploadId,key:up.key});}catch(err){return jsonResponseV32({mensagem:String(err?.message||"Falha ao iniciar multipart.")},500);}
  }

  matchPacoteV321=caminho.match(/^\/pacotes\/(\d+)\/arquivos\/(\d+)\/mpu\/parte$/);
  if(matchPacoteV321 && metodo==="POST"){
    const usuario=await obterUsuarioLogado(request,env); if(!usuario) return jsonResponseV32({mensagem:"Sessão expirada."},401);
    if(!env.STL_BUCKET||!request.body) return jsonResponseV32({mensagem:"Parte do arquivo ausente."},400);
    const pacote=await obterPacoteV321(env,Number(matchPacoteV321[1]),usuario.id); if(!pacote||!(await usuarioPodeAcessarUploadPacoteV3171(env,usuario,pacote))) return jsonResponseV32({mensagem:"Acesso negado."},403);
    const arquivo=await env.db.prepare(`SELECT * FROM arquivos_pacotes_digitais WHERE id=? AND pacote_id=? LIMIT 1`).bind(Number(matchPacoteV321[2]),pacote.id).first(); if(!arquivo||arquivo.status!=="PENDENTE") return jsonResponseV32({mensagem:"Arquivo inválido."},400);
    const uploadId=String(url.searchParams.get("uploadId")||""),partNumber=Number(url.searchParams.get("partNumber")||0); if(!uploadId||!Number.isInteger(partNumber)||partNumber<1||partNumber>10000) return jsonResponseV32({mensagem:"UploadId ou número da parte inválido."},400);
    try{const up=env.STL_BUCKET.resumeMultipartUpload(arquivo.chave_r2,uploadId);const parte=await up.uploadPart(partNumber,request.body);return jsonResponseV32({partNumber:parte.partNumber,etag:parte.etag});}catch(err){return jsonResponseV32({mensagem:String(err?.message||"Falha no envio da parte.")},400);}
  }

  matchPacoteV321=caminho.match(/^\/pacotes\/(\d+)\/arquivos\/(\d+)\/mpu\/concluir$/);
  if(matchPacoteV321 && metodo==="POST"){
    const usuario=await obterUsuarioLogado(request,env); if(!usuario) return jsonResponseV32({mensagem:"Sessão expirada."},401);
    if(!env.STL_BUCKET) return jsonResponseV32({mensagem:"R2 indisponível."},500);
    const pacote=await obterPacoteV321(env,Number(matchPacoteV321[1]),usuario.id); if(!pacote||!(await usuarioPodeAcessarUploadPacoteV3171(env,usuario,pacote))) return jsonResponseV32({mensagem:"Acesso negado."},403);
    const arquivo=await env.db.prepare(`SELECT * FROM arquivos_pacotes_digitais WHERE id=? AND pacote_id=? LIMIT 1`).bind(Number(matchPacoteV321[2]),pacote.id).first(); if(!arquivo||arquivo.status!=="PENDENTE") return jsonResponseV32({mensagem:"Arquivo inválido."},400);
    const uploadId=String(url.searchParams.get("uploadId")||""); let b;try{b=await request.json();}catch(_){return jsonResponseV32({mensagem:"Lista de partes inválida."},400);} const parts=Array.isArray(b?.parts)?b.parts.map(x=>({partNumber:Number(x.partNumber),etag:String(x.etag||"")})).filter(x=>Number.isInteger(x.partNumber)&&x.partNumber>0&&x.etag):[]; if(!uploadId||!parts.length) return jsonResponseV32({mensagem:"Partes do upload ausentes."},400);
    try{
      parts.sort((a,b)=>a.partNumber-b.partNumber); const up=env.STL_BUCKET.resumeMultipartUpload(arquivo.chave_r2,uploadId); const obj=await up.complete(parts);
      if(Number(obj.size||0)!==Number(arquivo.tamanho_bytes||0)){await env.STL_BUCKET.delete(arquivo.chave_r2);return jsonResponseV32({mensagem:"O tamanho recebido não corresponde ao arquivo local. Envio cancelado."},400);}
      await env.db.prepare(`UPDATE arquivos_pacotes_digitais SET status='ATIVO' WHERE id=? AND status='PENDENTE'`).bind(arquivo.id).run();
      const pend=await env.db.prepare(`SELECT COUNT(*) AS total FROM arquivos_pacotes_digitais WHERE pacote_id=? AND status='PENDENTE'`).bind(pacote.id).first();
      if(Number(pend?.total||0)===0){const soma=await env.db.prepare(`SELECT COUNT(*) AS q,COALESCE(SUM(tamanho_bytes),0) AS t FROM arquivos_pacotes_digitais WHERE pacote_id=? AND status='ATIVO'`).bind(pacote.id).first();await registrarEventoPacoteV321(env,pacote.id,usuario.id,"UPLOAD_CONCLUIDO",Number(soma?.q||0),Number(soma?.t||0),"Todos os arquivos do pacote foram enviados ao R2.");}
      return jsonResponseV32({mensagem:"Arquivo concluído.",etag:obj.httpEtag||""});
    }catch(err){try{await registrarEventoPacoteV321(env,pacote.id,usuario.id,"UPLOAD_FALHOU",1,Number(arquivo.tamanho_bytes||0),String(err?.message||"Falha multipart").slice(0,500));}catch(_){ }return jsonResponseV32({mensagem:String(err?.message||"Falha ao concluir upload.")},400);}
  }

  matchPacoteV321=caminho.match(/^\/pacotes\/(\d+)\/arquivos\/(\d+)\/mpu\/abortar$/);
  if(matchPacoteV321 && metodo==="POST"){
    const usuario=await obterUsuarioLogado(request,env); if(!usuario) return jsonResponseV32({mensagem:"Sessão expirada."},401);
    const pacote=await obterPacoteV321(env,Number(matchPacoteV321[1]),usuario.id); if(!pacote||!(await usuarioPodeAcessarUploadPacoteV3171(env,usuario,pacote))) return jsonResponseV32({mensagem:"Acesso negado."},403);
    const arquivo=await env.db.prepare(`SELECT * FROM arquivos_pacotes_digitais WHERE id=? AND pacote_id=? LIMIT 1`).bind(Number(matchPacoteV321[2]),pacote.id).first(); const uploadId=String(url.searchParams.get("uploadId")||""); if(!arquivo||!uploadId||!env.STL_BUCKET) return jsonResponseV32({mensagem:"Upload inválido."},400);
    try{await env.STL_BUCKET.resumeMultipartUpload(arquivo.chave_r2,uploadId).abort();return jsonResponseV32({mensagem:"Upload multipart abortado."});}catch(err){return jsonResponseV32({mensagem:String(err?.message||"Falha ao abortar upload.")},400);}
  }

  matchPacoteV321=caminho.match(/^\/pacotes\/(\d+)\/arquivos\/(\d+)\/download$/);
  if(matchPacoteV321 && metodo==="GET"){
    const usuario=await obterUsuarioLogado(request,env); if(!usuario) return redirect("/"); if(!env.STL_BUCKET) return textResponse("R2 indisponível.",500);
    const pacote=await obterPacoteV321(env,Number(matchPacoteV321[1]),usuario.id); if(!pacote||!(await usuarioPodeAcessarPacoteV3171(env,usuario,pacote))) return textResponse("Acesso negado.",403);
    const arquivo=await env.db.prepare(`SELECT * FROM arquivos_pacotes_digitais WHERE id=? AND pacote_id=? AND status='ATIVO' LIMIT 1`).bind(Number(matchPacoteV321[2]),pacote.id).first(); if(!arquivo) return textResponse("Arquivo não encontrado.",404);
    const obj=await env.STL_BUCKET.get(arquivo.chave_r2); if(!obj) return textResponse("Arquivo físico não encontrado no R2.",404);
    try{await env.db.prepare(`UPDATE arquivos_pacotes_digitais SET baixado_em = COALESCE(baixado_em, ?), baixado_por = COALESCE(baixado_por, ?) WHERE id = ?`).bind(new Date().toISOString(), usuario.id, arquivo.id).run();}catch(_){ }
try{await env.db.prepare(`INSERT INTO downloads_pacotes_digitais (pacote_id,usuario_id,tipo_download,quantidade_arquivos,tamanho_total_bytes) VALUES (?,?,'ARQUIVO_INDIVIDUAL',1,?)`).bind(pacote.id,usuario.id,arquivo.tamanho_bytes).run();await registrarEventoPacoteV321(env,pacote.id,usuario.id,"DOWNLOAD_ARQUIVO",1,arquivo.tamanho_bytes,arquivo.caminho_relativo);}catch(_){ }
    const h=new Headers(cabecalhosSegurancaV30(arquivo.mime_type||"application/octet-stream")); const nome=String(arquivo.nome_original||"arquivo").replace(/[\r\n]/g," ").slice(0,180); h.set("Content-Disposition",`attachment; filename="arquivo"; filename*=UTF-8''${encodeURIComponent(nome)}`); h.set("Cache-Control","no-store"); return new Response(obj.body,{headers:h});
  }

  matchPacoteV321=caminho.match(/^\/pacotes\/(\d+)\/download$/);
  if(matchPacoteV321 && metodo==="GET"){
    const usuario=await obterUsuarioLogado(request,env); if(!usuario) return redirect("/"); if(!env.STL_BUCKET) return textResponse("R2 indisponível.",500);
    const pacote=await obterPacoteV321(env,Number(matchPacoteV321[1]),usuario.id); if(!pacote||!(await usuarioPodeAcessarPacoteV3171(env,usuario,pacote))) return textResponse("Acesso negado.",403);
    if(pacote.status!=="ATIVO"||Number(pacote.pendentes||0)>0) return textResponse("Pacote ainda não está pronto para download completo.",409);
    const arquivos=await listarArquivosPacoteV321(env,pacote.id,false); const ativos=arquivos.filter(a=>a.status==="ATIVO"); if(!ativos.length) return textResponse("Pacote sem arquivos ativos.",404);
    return respostaZipPacoteV321(env,usuario,pacote,ativos);
  }

  matchPacoteV321=caminho.match(/^\/pacotes\/(\d+)\/confirmar-recebimento$/);
  if(matchPacoteV321 && metodo==="POST"){
    const usuario=await obterUsuarioLogado(request,env); if(!usuario) return redirect("/");
    const pacote=await obterPacoteV321(env,Number(matchPacoteV321[1]),usuario.id); if(!pacote||!(await usuarioPodeAcessarPacoteV3171(env,usuario,pacote))) return textResponse("Acesso negado.",403);
    const arquivos=(await listarArquivosPacoteV321(env,pacote.id,false)).filter(a=>a.status==="ATIVO");
    try{await confirmarRecebimentoPacoteV344(env,usuario,pacote,arquivos);return redirect(`${urlBasePacoteV3171(pacote)}?ok=${encodeURIComponent("Recebimento e conferência confirmados. A exclusão segue as permissões do setor de destino.")}`);}catch(err){return redirect(`${urlBasePacoteV3171(pacote)}?erro=${encodeURIComponent(String(err?.message||"Falha ao confirmar recebimento."))}`);}
  }

  matchPacoteV321=caminho.match(/^\/pacotes\/(\d+)\/cancelar$/);
  if(matchPacoteV321 && metodo==="POST"){
    const usuario=await obterUsuarioLogado(request,env); if(!usuario) return jsonResponseV32({mensagem:"Sessão expirada."},401); if(!env.STL_BUCKET) return jsonResponseV32({mensagem:"R2 indisponível."},500);
    const pacote=await obterPacoteV321(env,Number(matchPacoteV321[1]),usuario.id); if(!pacote||!(await usuarioPodeAcessarUploadPacoteV3171(env,usuario,pacote))) return jsonResponseV32({mensagem:"Acesso negado."},403); if(pacote.status!=="ATIVO") return jsonResponseV32({mensagem:"Pacote já encerrado."},400);
    const arquivos=await listarArquivosPacoteV321(env,pacote.id,false); try{await deletarChavesR2V321(env.STL_BUCKET,arquivos.map(a=>a.chave_r2));await env.db.prepare(`UPDATE arquivos_pacotes_digitais SET status='EXCLUIDO',excluido_por=?,excluido_em=CURRENT_TIMESTAMP,motivo_exclusao='Upload cancelado/incompleto.' WHERE pacote_id=? AND status!='EXCLUIDO'`).bind(usuario.id,pacote.id).run();await env.db.prepare(`UPDATE pacotes_arquivos_digitais SET status='CANCELADO',excluido_por=?,excluido_em=CURRENT_TIMESTAMP,motivo_exclusao='Upload cancelado/incompleto.' WHERE id=?`).bind(usuario.id,pacote.id).run();await registrarEventoPacoteV321(env,pacote.id,usuario.id,"CANCELADO",arquivos.length,arquivos.reduce((s,a)=>s+Number(a.tamanho_bytes||0),0),"Pacote incompleto cancelado.");return redirect(`${urlBasePacoteV3171(pacote)}?ok=${encodeURIComponent("Pacote incompleto cancelado e espaço reservado liberado.")}`);}catch(err){return redirect(`${urlBasePacoteV3171(pacote)}?erro=${encodeURIComponent(String(err?.message||"Falha ao cancelar pacote."))}`);}
  }

  matchPacoteV321=caminho.match(/^\/pacotes\/(\d+)\/excluir$/);
  if(matchPacoteV321 && metodo==="POST"){
    const usuario=await obterUsuarioLogado(request,env); if(!usuario) return redirect("/"); if(!env.STL_BUCKET) return textResponse("R2 indisponível.",500);
    const pacote=await obterPacoteV321(env,Number(matchPacoteV321[1]),usuario.id); if(!pacote||!(await usuarioPodeAcessarPacoteV3171(env,usuario,pacote))) return textResponse("Acesso negado.",403);
    if(!(await usuarioPodeExcluirPacoteV321(env,usuario,pacote))) return redirect(`${urlBasePacoteV3171(pacote)}?erro=${encodeURIComponent("Exclusão bloqueada: o setor de destino precisa confirmar o recebimento e a conferência da pasta completa.")}`);
    const f=await request.formData(),motivo=String(f.get("motivo")||"").trim(); if(motivo.length<5) return redirect(`${urlBasePacoteV3171(pacote)}?erro=${encodeURIComponent("Informe o motivo da exclusão.")}`);
    const arquivos=await listarArquivosPacoteV321(env,pacote.id,false),total=arquivos.reduce((s,a)=>s+Number(a.tamanho_bytes||0),0); await registrarEventoPacoteV321(env,pacote.id,usuario.id,"EXCLUSAO_INICIADA",arquivos.length,total,motivo);
    try{await deletarChavesR2V321(env.STL_BUCKET,arquivos.map(a=>a.chave_r2));await env.db.prepare(`UPDATE arquivos_pacotes_digitais SET status='EXCLUIDO',excluido_por=?,excluido_em=CURRENT_TIMESTAMP,motivo_exclusao=? WHERE pacote_id=? AND status!='EXCLUIDO'`).bind(usuario.id,motivo,pacote.id).run();await env.db.prepare(`UPDATE pacotes_arquivos_digitais SET status='EXCLUIDO',excluido_por=?,excluido_em=CURRENT_TIMESTAMP,motivo_exclusao=? WHERE id=?`).bind(usuario.id,motivo,pacote.id).run();await registrarEventoPacoteV321(env,pacote.id,usuario.id,"EXCLUSAO_R2_CONCLUIDA",arquivos.length,total,`${motivo} · ${total} bytes liberados.`);await registrarAuditoriaSistemaV31(env,usuario.id,"DIGITAL","EXCLUIR_PACOTE_R2","PACOTE_DIGITAL",pacote.id,"status","ATIVO","EXCLUIDO",motivo);return redirect(`${urlBasePacoteV3171(pacote)}?ok=${encodeURIComponent(`Pacote excluído do armazenamento. ${formatarBytesV32(total)} liberados.`)}`);}catch(err){await registrarEventoPacoteV321(env,pacote.id,usuario.id,"EXCLUSAO_FALHOU",arquivos.length,total,String(err?.message||"Falha R2").slice(0,500));return redirect(`${urlBasePacoteV3171(pacote)}?erro=${encodeURIComponent("Falha ao excluir arquivos físicos do R2. Nenhum histórico foi apagado.")}`);}
  }



  return null;
}
