// FLUXO LAB V4.6.0 — ROTAS DE REMESSAS
// Controlador separado do despachante principal. Preserva SQL, validações, permissões e respostas.
// Inclui cadastro/edição, vínculo de pacientes, finalização e entrega no fluxo Digital.

export async function handleRemittanceCrudRoutesV46(request, env, url, caminho, deps) {
  const {
    obterUsuarioLogado, redirect, podeCadastrarDigitalV3418, textResponse,
    obterRemessa, retornoCadastroDigitalV3418, gerarCodigoTrabalho,
    criarEtapasDoTrabalho, registrarHistorico, registrarAuditoriaSistemaV31,
    isCadastro, obterCicloDigitalV311, podeGerenciarAreaV31
  } = deps;
  const metodo = request.method;
  let match = null;

  let matchV311 = caminho.match(/^\/remessas\/(\d+)\/novo-paciente$/);
  if (matchV311 && metodo === "POST") {
    const usuario = await obterUsuarioLogado(request, env);
    if (!usuario) return redirect("/");
    if (!podeCadastrarDigitalV3418(usuario)) return textResponse("Acesso negado.",403);
    const remessa = await obterRemessa(env,Number(matchV311[1]));
    if (!remessa || !remessa.ciclo_digital_id) return textResponse("Remessa Digital com ciclo não encontrada.",404);
    if (remessa.data_finalizacao || remessa.data_entrega_real) return textResponse("Esta remessa já foi finalizada ou entregue e não aceita novos pacientes.",409);
    const f = await request.formData();
    const paciente = String(f.get("paciente")||"").trim();
    const superior = String(f.get("superior_tipo")||"NONE").toUpperCase();
    const inferior = String(f.get("inferior_tipo")||"NONE").toUpperCase();
    const validos=["NONE","PT","PPR"];
    if (paciente.length<2 || !validos.includes(superior) || !validos.includes(inferior) || (superior==="NONE"&&inferior==="NONE")) {
      return redirect(retornoCadastroDigitalV3418(usuario, remessa.ciclo_digital_id, "erro", "Confira paciente e prótese."));
    }
    let codigo="",criado=null;
    for(let tentativa=0;tentativa<5&&!criado;tentativa++){
      codigo=await gerarCodigoTrabalho(env);
      try{criado=await env.db.prepare(`INSERT INTO trabalhos (codigo,municipio,paciente,superior_tipo,inferior_tipo,remessa_id,criado_por,criado_em,entregue,arquivado,excluido) VALUES (?,?,?,?,?,?,?, ?,0,0,0)`).bind(codigo,String(remessa.municipio||"").trim(),paciente,superior,inferior,remessa.id,usuario.id,new Date().toISOString()).run();}
      catch(err){if(!/unique|constraint/i.test(String(err?.message||err))||tentativa===4)throw err;}
    }
    const trabalhoId=Number(criado?.meta?.last_row_id||0);
    await criarEtapasDoTrabalho(env,trabalhoId,superior,inferior);
    await registrarHistorico(env,trabalhoId,usuario.id,"TRABALHO_CRIADO",`Trabalho ${codigo} criado dentro de ${remessa.municipio} · Remessa ${String(remessa.numero).padStart(2,"0")}.`);
    await registrarAuditoriaSistemaV31(env,usuario.id,"DIGITAL","CRIAR_PACIENTE_REMESSA","TRABALHO",trabalhoId,"remessa_id",null,remessa.id,null);
    return redirect(retornoCadastroDigitalV3418(usuario, remessa.ciclo_digital_id, "ok", `${paciente} criado dentro da remessa.`));
  }

  matchV311 = caminho.match(/^\/remessas\/(\d+)\/editar$/);
  if (matchV311 && metodo === "POST") {
    const usuario = await obterUsuarioLogado(request, env);
    if (!usuario) return redirect("/");
    if (!podeCadastrarDigitalV3418(usuario)) return textResponse("Acesso negado.",403);
    const id=Number(matchV311[1]);
    const antes=await obterRemessa(env,id);
    if (!antes) return textResponse("Remessa não encontrada.",404);
    if (isCadastro(usuario) && (antes.data_finalizacao || antes.data_entrega_real)) return textResponse("Remessa encerrada: o perfil Cadastro possui somente consulta.",409);
    const f=await request.formData();
    const municipio=String(f.get("municipio")||"").trim();
    const receb=String(f.get("data_recebimento")||"").trim();
    const prev=String(f.get("data_prevista_entrega")||"").trim();
    const obs=String(f.get("observacao")||"").trim().slice(0,500);
    const motivo=String(f.get("motivo")||"").trim();
    const entregaCampo=String(f.get("data_entrega_real")||"").trim();
    const entregaNova=isCadastro(usuario) ? String(antes.data_entrega_real||"") : (antes.data_entrega_real ? entregaCampo : String(antes.data_entrega_real||""));
    if (municipio.length<2 || municipio.length>120 || !/^\d{4}-\d{2}-\d{2}$/.test(receb) || !/^\d{4}-\d{2}-\d{2}$/.test(prev) || prev<receb || motivo.length<3 || (antes.data_entrega_real && (!/^\d{4}-\d{2}-\d{2}$/.test(entregaNova) || entregaNova<receb))) {
      return redirect(retornoCadastroDigitalV3418(usuario, antes.ciclo_digital_id||0, "erro", "Confira município, datas e motivo da alteração."));
    }
    const mudouMunicipio=String(antes.municipio||"").trim().toLowerCase()!==municipio.toLowerCase();
    if (mudouMunicipio) {
      const conv=await env.db.prepare(`SELECT COUNT(*) AS total FROM trabalhos_convencionais WHERE remessa_id=? AND excluido=0`).bind(id).first();
      if (Number(conv?.total||0)>0) return redirect(retornoCadastroDigitalV3418(usuario, antes.ciclo_digital_id||0, "erro", "Esta remessa possui vínculo convencional legado. O município não pode ser alterado nesta tela."));
    }
    await env.db.prepare(`UPDATE remessas SET municipio=?,data_recebimento=?,data_prevista_entrega=?,observacao=?,data_entrega_real=? WHERE id=?`).bind(municipio,receb,prev,obs||null,antes.data_entrega_real?entregaNova:null,id).run();
    if (mudouMunicipio) await env.db.prepare(`UPDATE trabalhos SET municipio=? WHERE remessa_id=? AND excluido=0`).bind(municipio,id).run();
    const campos=[
      ["municipio",antes.municipio,municipio],
      ["data_recebimento",antes.data_recebimento,receb],
      ["data_prevista_entrega",antes.data_prevista_entrega,prev],
      ["observacao",antes.observacao||"",obs],
      ["data_entrega_real",antes.data_entrega_real||"",antes.data_entrega_real?entregaNova:""]
    ];
    for (const [campo,a,n] of campos) if (String(a||"")!==String(n||"")) await registrarAuditoriaSistemaV31(env,usuario.id,"DIGITAL","EDITAR_REMESSA","REMESSA",id,campo,a||null,n||null,motivo);
    return redirect(retornoCadastroDigitalV3418(usuario, antes.ciclo_digital_id||0, "ok", "Remessa atualizada com histórico de auditoria."));
  }

  if (caminho === "/remessas" && metodo === "POST") {
    const usuario=await obterUsuarioLogado(request,env);if(!usuario)return redirect("/");if(!podeCadastrarDigitalV3418(usuario))return textResponse("Acesso restrito ao cadastro Digital.",403);
    const f=await request.formData();
    const cicloId=Number(f.get("ciclo_digital_id")||0);
    const ciclo=await obterCicloDigitalV311(env,cicloId);
    const municipio=String(f.get("municipio")||"").trim(),receb=String(f.get("data_recebimento")||""),prev=String(f.get("data_prevista_entrega")||""),obs=String(f.get("observacao")||"").trim().slice(0,500);
    if(!ciclo||municipio.length<2||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(receb)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(prev)||prev<receb)return redirect(retornoCadastroDigitalV3418(usuario, cicloId||0, "erro", "Confira ciclo, município e datas da remessa."));
    const ult=await env.db.prepare(`SELECT COALESCE(MAX(numero),0) AS maior FROM remessas WHERE lower(trim(municipio))=lower(trim(?))`).bind(municipio).first();
    const numero=Number(ult?.maior||0)+1;
    const r=await env.db.prepare(`INSERT INTO remessas (municipio,numero,data_recebimento,data_prevista_entrega,observacao,criado_por,criado_em,ciclo_digital_id) VALUES (?,?,?,?,?,?,?,?)`).bind(municipio,numero,receb,prev,obs||null,usuario.id,new Date().toISOString(),ciclo.id).run();
    await registrarAuditoriaSistemaV31(env,usuario.id,"DIGITAL","CRIAR_REMESSA","REMESSA",r.meta.last_row_id,"ciclo_digital_id",null,ciclo.id,`${municipio} #${numero}`);
    return redirect(retornoCadastroDigitalV3418(usuario, ciclo.id, "ok", `${municipio} · Remessa ${String(numero).padStart(2,"0")} criada no ciclo ${ciclo.nome}.`));
  }

  match=caminho.match(/^\/remessas\/(\d+)\/vincular-paciente$/);
  if(match&&metodo==="POST"){
    const usuario=await obterUsuarioLogado(request,env);if(!usuario)return redirect("/");if(!podeCadastrarDigitalV3418(usuario))return textResponse("Acesso negado.",403);
    const remessa=await obterRemessa(env,Number(match[1]));if(!remessa)return textResponse("Remessa não encontrada.",404);
    if(remessa.data_finalizacao||remessa.data_entrega_real)return redirect(retornoCadastroDigitalV3418(usuario, remessa.ciclo_digital_id||0, "erro", "Esta remessa já foi finalizada ou entregue. Crie uma nova remessa para novos pacientes."));
    const f=await request.formData(),trabalhoId=Number(f.get("trabalho_id"));
    const trab=await env.db.prepare(`SELECT * FROM trabalhos WHERE id=? AND excluido=0 AND arquivado=0 AND entregue=0 AND remessa_id IS NULL LIMIT 1`).bind(trabalhoId).first();
    if(!trab)return redirect(retornoCadastroDigitalV3418(usuario, remessa.ciclo_digital_id||0, "erro", "Paciente indisponível para vínculo."));
    if(String(trab.municipio||"").trim().toLowerCase()!==String(remessa.municipio||"").trim().toLowerCase())return redirect(retornoCadastroDigitalV3418(usuario, remessa.ciclo_digital_id||0, "erro", "O paciente pertence a outro município."));
    const agora=new Date().toISOString();
    try{
      const lote=await env.db.batch([
        env.db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM remessas WHERE id=? AND data_finalizacao IS NULL AND data_entrega_real IS NULL) THEN 1 ELSE json('remessa_encerrada') END`).bind(remessa.id),
        env.db.prepare(`UPDATE trabalhos SET remessa_id=? WHERE id=? AND excluido=0 AND arquivado=0 AND entregue=0 AND remessa_id IS NULL`).bind(remessa.id,trabalhoId),
        env.db.prepare(`INSERT INTO historico (trabalho_id,usuario_id,acao,detalhes,criado_em) VALUES (?,?,?,?,?)`).bind(trabalhoId,usuario.id,"REMESSA_VINCULADA",`Vinculado à Remessa ${String(remessa.numero).padStart(2,"0")} de ${remessa.municipio}.`,agora),
        env.db.prepare(`INSERT INTO auditoria_sistema_v31 (area,usuario_id,acao,entidade,registro_id,campo,valor_anterior,valor_novo,motivo,criado_em) VALUES ('DIGITAL',?,'VINCULAR_PACIENTE_REMESSA','TRABALHO',?,'remessa_id',NULL,?,NULL,?)`).bind(usuario.id,String(trabalhoId),String(remessa.id),agora)
      ]);
      if(Number(lote[1]?.meta?.changes||0)<1)throw new Error('Paciente alterado em outra sessão.');
    }catch(_){return redirect(retornoCadastroDigitalV3418(usuario, remessa.ciclo_digital_id||0, "erro", "A remessa ou o paciente mudou durante a operação. Nada foi vinculado."));}
    return redirect(retornoCadastroDigitalV3418(usuario, remessa.ciclo_digital_id||0, "ok", "Paciente adicionado à remessa."));
  }

  match=caminho.match(/^\/remessas\/(\d+)\/finalizar$/);
  if(match&&metodo==="POST"){const usuario=await obterUsuarioLogado(request,env);if(!usuario)return redirect("/");if(!podeGerenciarAreaV31(usuario,"DIGITAL"))return textResponse("Acesso negado.",403);const id=Number(match[1]),remessa=await obterRemessa(env,id);if(!remessa)return textResponse("Remessa não encontrada.",404);const f=await request.formData(),data=String(f.get("data_finalizacao")||new Date().toISOString().slice(0,10));const c=await env.db.prepare(`SELECT COUNT(*) AS total,SUM(CASE WHEN NOT EXISTS(SELECT 1 FROM etapas e WHERE e.trabalho_id=t.id AND e.status!='CONCLUIDO') THEN 1 ELSE 0 END) AS prontos FROM trabalhos t WHERE t.remessa_id=? AND t.excluido=0`).bind(id).first();if(!Number(c.total||0)||Number(c.prontos||0)<Number(c.total||0))return redirect(`/digital?ciclo=${remessa.ciclo_digital_id||0}&erro=${encodeURIComponent("A remessa ainda possui pacientes em produção.")}`);await env.db.prepare(`UPDATE remessas SET data_finalizacao=?,finalizado_por=? WHERE id=?`).bind(data,usuario.id,id).run();return redirect(`/digital?ciclo=${remessa.ciclo_digital_id||0}&ok=${encodeURIComponent("Remessa marcada como pronta para entrega.")}`);}

  match=caminho.match(/^\/remessas\/(\d+)\/entregar$/);
  if(match&&metodo==="POST"){const usuario=await obterUsuarioLogado(request,env);if(!usuario)return redirect("/");if(!podeGerenciarAreaV31(usuario,"DIGITAL"))return textResponse("Acesso negado.",403);const id=Number(match[1]),remessa=await obterRemessa(env,id);if(!remessa)return textResponse("Remessa não encontrada.",404);const f=await request.formData(),data=String(f.get("data_entrega_real")||"").trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(data)||data<String(remessa.data_recebimento||""))return redirect(`/digital?ciclo=${remessa.ciclo_digital_id||0}&erro=${encodeURIComponent("Data de entrega inválida.")}`);const c=await env.db.prepare(`SELECT COUNT(*) AS total,SUM(CASE WHEN NOT EXISTS(SELECT 1 FROM etapas e WHERE e.trabalho_id=t.id AND e.status!='CONCLUIDO') THEN 1 ELSE 0 END) AS prontos FROM trabalhos t WHERE t.remessa_id=? AND t.excluido=0`).bind(id).first();const total=Number(c.total||0),prontos=Number(c.prontos||0);if(total===0||prontos!==total)return redirect(`/digital?ciclo=${remessa.ciclo_digital_id||0}&erro=${encodeURIComponent(`Entrega bloqueada: ${prontos}/${total} pacientes estão prontos.`)}`);await env.db.prepare(`UPDATE remessas SET data_finalizacao=COALESCE(data_finalizacao,?),finalizado_por=COALESCE(finalizado_por,?),data_entrega_real=?,entregue_por=? WHERE id=?`).bind(data,usuario.id,data,usuario.id,id).run();const trabalhos=await env.db.prepare(`SELECT id FROM trabalhos WHERE remessa_id=? AND excluido=0`).bind(id).all();await env.db.prepare(`UPDATE trabalhos SET entregue=1,data_entrega=?,entrega_registrada_por=?,arquivado=0 WHERE remessa_id=? AND excluido=0`).bind(data,usuario.id,id).run();for(const t of trabalhos.results||[])await registrarHistorico(env,t.id,usuario.id,"ENTREGA_REMESSA_COMPLETA",`Remessa ${String(remessa.numero).padStart(2,"0")} entregue integralmente em ${data}.`);await registrarAuditoriaSistemaV31(env,usuario.id,"DIGITAL","ENTREGA_REMESSA","REMESSA",id,"data_entrega_real",remessa.data_entrega_real||null,data,`Entrega integral de ${total} paciente(s).`);return redirect(`/digital?ciclo=${remessa.ciclo_digital_id||0}&ok=${encodeURIComponent(`${remessa.municipio} · Remessa ${String(remessa.numero).padStart(2,"0")} entregue integralmente.`)}`);}

  return null;
}