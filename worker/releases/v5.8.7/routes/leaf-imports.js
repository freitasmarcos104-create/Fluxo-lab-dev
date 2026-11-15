// FLUXO LAB V4.9.0 — CONTROLADOR DE IMPORTAÇÃO DE FOLHAS DIGITAL
// Mantém o fluxo de leitura, revisão, upload, confirmação, bloqueio e liberação do piloto.
// O processamento de PDF/imagens e as regras de confirmação permanecem nos serviços atuais.

export async function handleDigitalLeafImportsV49(request, env, url, caminho, deps) {
  const { LIMITE_ARQUIVO_V331, bloquearFolhaV331, confirmarFolhaV333, dadosRevisaoV331, erroFolhaV331, htmlResponse, jsonFolhaV331, lerPaginaFolhaV331, liberarFolhaV331, mimeArquivoImportacaoV330, mimeRealFolhaV331, obterImportacaoFolhaV330, obterUsuarioLogado, paginaImportacaoV330, planoConfirmacaoV333, podeImportarFolhasV330, redirect, rotearV31Base, salvarRevisaoV331, textResponse } = deps;

  // Recursos estáticos fixos do PDF.js: nenhum documento é enviado ao CDN.
  const recurso=caminho.match(/^\/importacoes\/recursos\/(pdf(?:\.worker)?\.mjs)$/);
  if(recurso&&request.method==='GET'){
    const usuario=await obterUsuarioLogado(request,env);if(!usuario||!podeImportarFolhasV330(usuario))return textResponse('Acesso negado.',403);
    const remoto=await fetch('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/'+recurso[1]);
    if(!remoto.ok)return textResponse('Não foi possível carregar o leitor de PDF. Tente novamente.',502);
    return new Response(remoto.body,{headers:{'Content-Type':'text/javascript; charset=UTF-8','Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff'}});
  }
  const match=caminho.match(/^\/importacoes\/(\d+)(?:\/(.*))?$/);
  if(!match)return rotearV31Base(request,env,url,caminho);
  const id=Number(match[1]),acao=match[2]||'';
  const usuario=await obterUsuarioLogado(request,env);
  if(!usuario)return request.method==='GET'?redirect('/'):jsonFolhaV331({mensagem:'Sessão expirada.'},401);
  if(!podeImportarFolhasV330(usuario))return jsonFolhaV331({mensagem:'Acesso restrito a perfis autorizados para cadastro.'},403);
  if(request.method==='GET'&&acao===''){
    try{
      const imp=await obterImportacaoFolhaV330(env,id);if(!imp||imp.area!=='DIGITAL')return textResponse('Importação Digital não encontrada.',404);
      const dados=await dadosRevisaoV331(env,id);
      // SELECT explícito detecta migração ausente sem executar DDL.
      await env.db.prepare('SELECT operacao_token,operacao_em FROM importacoes_folhas_producao WHERE id=?').bind(id).first();
      await env.db.prepare('SELECT item_id FROM linhas_importacao_folhas WHERE importacao_id=? LIMIT 1').bind(id).all();
      await env.db.prepare('SELECT chave_rascunho FROM itens_importacao_folhas WHERE importacao_id=? LIMIT 1').bind(id).all();
      await env.db.prepare('SELECT leitura_json FROM imagens_importacao_folhas WHERE importacao_id=? LIMIT 1').bind(id).all();
      return htmlResponse(paginaImportacaoV330(usuario,imp,dados.arquivos.filter(a=>a.status!=='EXCLUIDA'),url.searchParams.get('ok')||url.searchParams.get('erro')||'',url.searchParams.has('erro')?'erro':'sucesso',dados));
    }catch(e){return textResponse(/no such column/i.test(e.message)?'V3.3.1: aplique a migração SQL fornecida antes de abrir a leitura. O banco não foi alterado automaticamente.': 'Não foi possível abrir a conferência. Confira a migração e tente novamente.',500);}
  }
  if(request.method!=='POST')return rotearV31Base(request,env,url,caminho);
  if(request.headers.get('Origin')!==url.origin)return jsonFolhaV331({mensagem:'Origem da solicitação não permitida.'},403);
  let token;
  try{
    const inicial=await obterImportacaoFolhaV330(env,id);if(!inicial||inicial.area!=='DIGITAL')throw erroFolhaV331('Importação Digital não encontrada.',404);
    token=await bloquearFolhaV331(env,id);
    const imp=await obterImportacaoFolhaV330(env,id);
    if(acao==='confirmar'&&imp.status==='CONFIRMADO')return await confirmarFolhaV333(request,env,imp,usuario,token);
    if(['CONFIRMADO','CANCELADO'].includes(imp.status))throw erroFolhaV331('Importação encerrada.',409);
    if((imp.remessa_finalizacao||imp.remessa_entrega)&&acao!=='cancelar')throw erroFolhaV331('Remessa já finalizada ou entregue. A importação não pode criar pacientes.',409);
    if(!env.IMPORT_BUCKET)throw erroFolhaV331('Binding IMPORT_BUCKET ausente.',503);
    const leitura=acao.match(/^arquivos\/(\d+)\/ler$/);
    if(leitura)return await lerPaginaFolhaV331(request,env,imp,usuario,Number(leitura[1]),token);
    if(acao==='revisao')return await salvarRevisaoV331(request,env,imp,usuario);
    if(acao==='preparar-confirmacao'){const p=await planoConfirmacaoV333(env,imp);const {snapshot,remessa,...publico}=p;return jsonFolhaV331(publico);}
    if(acao==='confirmar')return await confirmarFolhaV333(request,env,imp,usuario,token);
    const excluir=acao.match(/^arquivos\/(\d+)\/excluir$/);
    if(excluir){const r=await env.db.prepare('SELECT COUNT(*) AS n FROM linhas_importacao_folhas WHERE importacao_id=? AND imagem_id=?').bind(id,Number(excluir[1])).first();if(r.n)throw erroFolhaV331('Este arquivo possui leitura salva. Preserve-o durante a conferência; para descartar toda a importação, use Cancelar.',409);}
    if(acao==='arquivos'){
      if(Number(request.headers.get('Content-Length')||0)>LIMITE_ARQUIVO_V331+100000)throw erroFolhaV331('Limite: 15 MB por arquivo.',413);
      const f=await request.clone().formData(),arquivo=f.get('arquivo');
      if(!arquivo||arquivo.size>LIMITE_ARQUIVO_V331)throw erroFolhaV331('Arquivo ausente ou acima de 15 MB.',413);
      const tipo=mimeRealFolhaV331(await arquivo.slice(0,16).arrayBuffer());
      if(!tipo||tipo!==mimeArquivoImportacaoV330(arquivo.name))throw erroFolhaV331('Tipo real do arquivo não corresponde à extensão.');
      const count=await env.db.prepare("SELECT COUNT(*) n FROM imagens_importacao_folhas WHERE importacao_id=? AND status!='EXCLUIDA'").bind(id).first();
      if(count.n>=20)throw erroFolhaV331('Limite do piloto: 20 arquivos por rascunho.');
    }
    return await rotearV31Base(request,env,url,caminho);
  }catch(e){
    const msg=/no such column/i.test(e.message)?'Aplique a migração V3.3.1 antes de usar a importação.':e.status?e.message:'Não foi possível concluir a operação. Os dados já salvos foram preservados; confira a migração e tente novamente.';
    return jsonFolhaV331({mensagem:msg},e.status||500);
  }finally{if(token)await liberarFolhaV331(env,id,token);}

}
