export function construirMensagemImpedimentoV516(remessaId,situacao,motivo,observacao){
  const remessa=Number(remessaId),st=String(situacao||""),mot=String(motivo||""),texto=String(observacao||"").trim();
  if(!Number.isSafeInteger(remessa)||remessa<=0||!["AGUARDANDO","NAO_PRODUZIR"].includes(st)||!["NAO_ENVIADO","SCAN_INVALIDO","MALHA_INVALIDA","ARQUIVO_INCOMPLETO","PACIENTE_INCORRETO","OUTRO"].includes(mot)||texto.length<5||texto.length>500)throw new Error("Informe a situação, o motivo e uma observação de 5 a 500 caracteres.");
  return `[FLREMESSA:${remessa}:${st}:${mot}] ${texto}`;
}

export function lerImpedimentoV516(valor,remessaId=0){
  const mensagem=String(valor||"");
  const m=mensagem.match(/^\[FLREMESSA:(\d+):(AGUARDANDO|NAO_PRODUZIR):([A-Z_]+)\]\s*([\s\S]*)$/);
  if(!m)return null;
  if(remessaId&&Number(m[1])!==Number(remessaId))return null;
  const motivos={NAO_ENVIADO:"Arquivo/scan não enviado",SCAN_INVALIDO:"Problema no scan",MALHA_INVALIDA:"Problema na malha 3D",ARQUIVO_INCOMPLETO:"Arquivo incompleto",PACIENTE_INCORRETO:"Paciente ou arquivo incorreto",OUTRO:"Outro impedimento"};
  const situacao=m[2]==="NAO_PRODUZIR"?"Não produzir nesta remessa":"Aguardando correção";
  if(!motivos[m[3]])return null;
  return {remessaId:Number(m[1]),situacaoCodigo:m[2],situacao,motivoCodigo:m[3],motivo:motivos[m[3]],observacao:m[4]};
}

export function escapeHtmlImpedimentoV516(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

export function resumoImpedimentosV516(pacientes){
  const itens=Array.isArray(pacientes)?pacientes:[];
  const impedidos=itens.filter(p=>!!lerImpedimentoV516(p.aviso_remessa,p.remessa_id||0)).length;
  return {total:itens.length,impedidos,semImpedimento:itens.length-impedidos};
}

export function sqlAvisoRemessaV516(alias="t"){
  if(!["t"].includes(alias))throw new Error("Alias SQL inválido");
  return `(SELECT ca.mensagem FROM chat_trabalho ca WHERE ca.trabalho_id=${alias}.id AND ca.tipo='PENDENCIA' AND ca.resolvido=0 AND ca.mensagem LIKE ('[FLREMESSA:' || ${alias}.remessa_id || ':%') ORDER BY ca.id DESC LIMIT 1)`;
}

export function renderAvisoRemessaV516(mensagem,remessaId=0){
 const aviso=lerImpedimentoV516(mensagem,remessaId);
 if(!aviso)return "";
 return `<div role="status" class="fl-impedimento-remessa-v516" style="margin-top:5px;border-left:3px solid #f59e0b;border-radius:5px;background:rgba(245,158,11,.12);padding:7px 9px;line-height:1.35;max-width:440px;overflow-wrap:anywhere"><strong style="color:#fbbf24">⚠ ${escapeHtmlImpedimentoV516(aviso.situacao)}</strong><div style="margin-top:3px"><strong>${escapeHtmlImpedimentoV516(aviso.motivo)}:</strong> ${escapeHtmlImpedimentoV516(aviso.observacao)}</div></div>`;
}

export function renderFormImpedimentoRemessaV516(trabalhoId,remessaId,mensagem,habilitado){
 if(!habilitado)return "";
 const id=Number(trabalhoId),rid=Number(remessaId);
 if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(rid)||rid<1)return "";
 const existente=lerImpedimentoV516(mensagem,rid);
 return `<details style="margin-top:6px;font-size:12px;max-width:300px"><summary style="cursor:pointer;color:#fbbf24;font-weight:700">⚠ ${existente?"Editar aviso":"Sinalizar problema"}</summary><form method="POST" action="/trabalhos/${id}/impedimento-remessa" style="margin-top:8px;display:grid;gap:7px"><input type="hidden" name="acao" value="registrar"><label style="margin:0">Situação<select name="situacao" required><option value="AGUARDANDO" ${existente?.situacaoCodigo==="AGUARDANDO"?"selected":""}>Aguardando correção</option><option value="NAO_PRODUZIR" ${existente?.situacaoCodigo==="NAO_PRODUZIR"?"selected":""}>Não produzir nesta remessa</option></select></label><label style="margin:0">Motivo<select name="motivo" required><option value="NAO_ENVIADO">Arquivo/scan não enviado</option><option value="SCAN_INVALIDO">Problema no scan</option><option value="MALHA_INVALIDA">Problema na malha 3D</option><option value="ARQUIVO_INCOMPLETO">Arquivo incompleto</option><option value="PACIENTE_INCORRETO">Paciente ou arquivo incorreto</option><option value="OUTRO">Outro impedimento</option></select></label><label style="margin:0">Recado para a equipe<textarea name="observacao" minlength="5" maxlength="500" required placeholder="Ex.: Não recebemos o scan superior; solicitar novo arquivo." rows="2">${existente?escapeHtmlImpedimentoV516(existente.observacao):""}</textarea></label><button class="botao" type="submit">Salvar aviso laranja</button></form>${existente?`<form method="POST" action="/trabalhos/${id}/impedimento-remessa" style="margin-top:6px"><input type="hidden" name="acao" value="resolver"><button class="botao botao-sec" type="submit">✓ Marcar como resolvido</button></form>`:""}</details>`;
}
