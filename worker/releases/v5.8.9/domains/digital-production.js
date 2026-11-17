// FLUXO LAB V4.8.0 — MOTOR DE PRODUÇÃO DIGITAL

// Preserva o mecanismo de versão do cartão, permissões e transação D1 atômica.



export function versaoProducaoV336DomainV48(r) {
  return JSON.stringify(['status','responsavel_id','recebido_em','iniciado_em','concluido_em','designado_por','designado_em','retrabalhos','executado_por'].map(k=>r[k]??null));
}

export function acaoProducaoV336DomainV48(u,r,tipo,deps = {}) {
  if(tipo==='retrabalhos'){
    if(!(deps.isCoord(u)||deps.podeOperarEtapa(u,r.setor)))return '';
    if(r.status==='ABERTO')return 'iniciar';
    if(r.status==='EM_ANDAMENTO'&&(deps.isCoord(u)||Number(r.executado_por)===Number(u.id)))return 'concluir';
    return '';
  }
  if(!deps.podeOperarEtapa(u,tipo==='etapas'?r.setor:'IMPRESSAO') || (tipo==='etapas'&&r.setor==='IMPRESSAO'))return '';
  if(r.status==='AGUARDANDO'&&r.recebido_em&&!(u.perfil==='FUNCIONARIO'&&r.responsavel_id&&Number(r.responsavel_id)!==Number(u.id)))return 'iniciar';
  if(r.status==='EM_ANDAMENTO'&&Number(r.responsavel_id)===Number(u.id))return 'concluir';
  return '';
}

export async function operarProducaoV336DomainV48(env,u,item,deps = {}){
  if(!item||!['etapas','componentes','retrabalhos'].includes(item.tipo)||!['iniciar','concluir'].includes(item.acao)||!Number.isSafeInteger(item.id)||item.id<1)throw Error('Item inválido.');
  const tabela=item.tipo==='retrabalhos'?'retrabalhos':item.tipo==='etapas'?'etapas':'componentes_impressao';
  const r=await env.db.prepare(`SELECT * FROM ${tabela} WHERE id=?`).bind(item.id).first();
  if(!r)throw Error('Item não encontrado.');
  if(deps.versaoProducaoV336(r)!==item.versao)throw Error('Este item mudou. Atualize os cartões e confira antes de selecionar novamente.');
  if(deps.acaoProducaoV336(u,r,item.tipo)!==item.acao)throw Error('Ação indisponível para seu usuário ou para o estado atual.');
  const campos=item.tipo==='retrabalhos'?['status','executado_por','iniciado_em','concluido_em']:['status','responsavel_id','recebido_em','iniciado_em','concluido_em','designado_por','designado_em'];
  if(item.tipo==='etapas')campos.push('retrabalhos');
  // A guarda e todas as escritas são uma única transação D1. Concorrência aborta sem histórico parcial.
  const guard=env.db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM ${tabela} x JOIN trabalhos t ON t.id=x.trabalho_id WHERE x.id=? AND ${campos.map(k=>`x.${k} IS ?`).join(' AND ')} AND COALESCE(t.excluido,0)=0 AND COALESCE(t.arquivado,0)=0 AND COALESCE(t.entregue,0)=0) THEN 1 ELSE json('conflito_producao') END`).bind(r.id,...campos.map(k=>r[k]??null));
  const stmts=[guard];
  // Reutiliza a validação e as escritas da produção existente; adia as escritas para batch atômico.
  const coletor={...env,db:{prepare(sql){let args=[];const q={bind(...a){args=a;return q;},async run(){stmts.push(env.db.prepare(sql).bind(...args));return {meta:{changes:1}};},async first(){
    if(item.tipo==='componentes'&&item.acao==='concluir'&&/COUNT\(\*\) AS total/.test(sql))return {total:0};
    throw Error('Consulta de produção não suportada.');
  }};return q;}}};
  const fn=item.tipo==='retrabalhos'?(item.acao==='iniciar'?deps.iniciarRetrabalho:deps.concluirRetrabalho):item.tipo==='etapas'?(item.acao==='iniciar'?deps.iniciarEtapa:deps.concluirEtapa):(item.acao==='iniciar'?deps.iniciarComponente:deps.concluirComponente);
  await fn(coletor,r,u);
  if(item.tipo==='componentes'&&item.acao==='concluir'){
    // As duas últimas escritas só liberam acabamento quando TODOS os componentes terminaram,
    // consultando o estado dentro da transação, inclusive se outro operador concluiu em paralelo.
    for(let n=stmts.length-2;n<stmts.length;n++){
      // As mesmas duas escritas são reconstruídas porque D1PreparedStatement não expõe SQL.
      const setor=n===stmts.length-2?'IMPRESSAO':'ACABAMENTO';
      const set=setor==='IMPRESSAO'?"status='CONCLUIDO',concluido_em=?":"recebido_em=COALESCE(recebido_em,?)";
      stmts[n]=env.db.prepare(`UPDATE etapas SET ${set} WHERE trabalho_id=? AND arcada=? AND setor=? AND NOT EXISTS(SELECT 1 FROM componentes_impressao WHERE trabalho_id=? AND arcada=? AND status!='CONCLUIDO')`).bind(new Date().toISOString(),r.trabalho_id,r.arcada,setor,r.trabalho_id,r.arcada);
    }
  }
  try{await env.db.batch(stmts);}catch{throw Error('Não foi possível gravar este item: ele mudou, o trabalho foi encerrado ou houve falha no banco. Atualize e confira.');}
  // Reconhecimento roda depois do commit real; falha no aviso nunca desfaz a produção.
  if(item.acao==='concluir' && (item.tipo==='etapas' || item.tipo==='componentes')){
    const responsavelId=Number(r.responsavel_id || u.id);
    try{await deps.verificarMetaAtingidaV318(env,responsavelId);}
    catch(erro){console.error('[Fluxo Lab V3.18.1] Falha no reconhecimento automático:',erro?.message||erro);}
  }
  return {trabalho_id:r.trabalho_id};
}
