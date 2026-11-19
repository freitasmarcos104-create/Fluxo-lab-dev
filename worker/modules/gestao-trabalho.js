// O atalho sempre identifica o trabalho pela ficha vinculada, inclusive nos cartões de etapa.
export const atalhosLixeira = String.raw`<script>
(() => {
  const main = document.querySelector('main.container');
  if (!main || location.pathname.startsWith('/gestao-trabalho/')) return;
  function atalho(prefixo,id) {
    const link = document.createElement('a');
    link.href = '/gestao-trabalho/' + prefixo + '/' + id;
    link.textContent = '🗑️';
    link.title = 'Editar ou excluir trabalho #' + id;
    link.setAttribute('aria-label',link.title);
    link.style.cssText = 'display:inline-block;padding:6px;margin-inline:4px;text-decoration:none';
    return link;
  }
  const vistos = new WeakMap();
  function adicionar(alvo,prefixo,id) {
    const grupo = alvo.closest('tr,article,[data-producao]') || alvo.parentElement;
    let ids = vistos.get(grupo);
    if (!ids) vistos.set(grupo,ids=new Set());
    const chave = prefixo+'/'+id;
    if (ids.has(chave)) return;
    ids.add(chave);
    alvo.after(atalho(prefixo,id));
  }
  for (const link of main.querySelectorAll('a[href]')) {
    const m = link.pathname.match(/^\/(convencional\/)?trabalhos\/(\d+)\/?$/);
    if (link.origin===location.origin && m) adicionar(link,m[1]?'convencional':'digital',m[2]);
  }
  for (const card of main.querySelectorAll('[data-producao][data-trabalho]')) {
    const id=card.dataset.trabalho;
    if (/^[1-9]\d*$/.test(id) && !card.querySelector('a[href^="/gestao-trabalho/"]')) card.prepend(atalho('digital',id));
  }
  const ficha = location.pathname.match(/^\/(convencional\/)?trabalhos\/(\d+)\/?$/);
  if (ficha) main.prepend(atalho(ficha[1]?'convencional':'digital',ficha[2]));
})();
</script>`;

export async function gerirTrabalho(request, db, usuario, area, id, {layout, htmlResponse, escapeHtml, redirect}) {
  if (usuario?.perfil !== "ADMINISTRADOR") return new Response("Acesso exclusivo do administrador.",{status:403});
  const digital = area === "digital";
  const tabela = digital ? "trabalhos" : "trabalhos_convencionais";
  const registro = await db.prepare(`SELECT paciente FROM ${tabela} WHERE id=? AND excluido=0`).bind(id).first();
  if (!registro) return new Response("Trabalho indisponível.",{status:404});
  const ficha = (digital ? "" : "/convencional") + "/trabalhos/" + id;
  if (request.method === "GET") {
    const nome = escapeHtml(registro.paciente);
    const r = htmlResponse(layout(`<section class="card"><h1>Editar ou excluir trabalho</h1><h2>${nome} · #${id}</h2>
      <form method="post"><label>Nome do paciente<input name="nome" maxlength="120" value="${nome}" required></label>
      <button name="acao" value="editar">Salvar correção</button></form><hr>
      <details><summary>🗑️ Excluir este trabalho</summary><p>O trabalho #${id} de ${nome} sairá das listas. O histórico será preservado.</p>
      <form method="post"><label>Motivo<input name="motivo" maxlength="500" required></label>
      <button class="botao-perigo" name="acao" value="excluir">Confirmar exclusão</button></form></details><p><a href="${ficha}">Voltar à ficha</a></p></section>`, "Gestão do trabalho",usuario));
    r.headers.set("Cache-Control","private, no-store");
    return r;
  }
  if (request.method !== "POST") return new Response(null,{status:405});
  if (request.headers.get("Origin") !== new URL(request.url).origin) return new Response("Origem inválida.",{status:403});
  const dados = await request.formData();
  const excluir = dados.get("acao")==="excluir";
  const valor = String(dados.get(excluir ? "motivo" : "nome") || "").trim();
  if ((!excluir && dados.get("acao")!=="editar") || !valor || valor.length>(excluir ? 500 : 120)) return new Response("Confira os dados.",{status:400});
  const acao = excluir ? "TRABALHO_EXCLUIDO" : "NOME_CORRIGIDO";
  const motivo = excluir ? valor : "Correção do nome do paciente";
  const agora = new Date().toISOString();
  const auditoria = digital ? db.prepare(`INSERT INTO historico(trabalho_id,usuario_id,acao,detalhes,criado_em)
    SELECT id,?,?,?,? FROM trabalhos WHERE id=? AND excluido=0`).bind(usuario.id,acao,excluir ? motivo : registro.paciente+" → "+valor,agora,id) :
    db.prepare(`INSERT INTO auditoria_convencional(trabalho_id,acao,valor_anterior,valor_novo,motivo,realizado_por,criado_em)
    SELECT id,?,paciente,?,?,?,? FROM trabalhos_convencionais WHERE id=? AND excluido=0`).bind(acao,excluir?null:valor,motivo,usuario.id,agora,id);
  let alterar;
  if (!excluir) alterar=db.prepare(`UPDATE ${tabela} SET paciente=? WHERE id=? AND excluido=0`).bind(valor,id);
  else if (digital) alterar=db.prepare("UPDATE trabalhos SET excluido=1,arquivado=1,excluido_em=?,excluido_por=?,motivo_exclusao=? WHERE id=? AND excluido=0").bind(agora,usuario.id,motivo,id);
  else alterar=db.prepare("UPDATE trabalhos_convencionais SET excluido=1 WHERE id=? AND excluido=0").bind(id);
  const [,resultado]=await db.batch([auditoria,alterar]);
  if (!resultado.meta.changes) return new Response("Trabalho indisponível.",{status:409});
  return redirect(excluir ? (digital ? "/trabalhos" : "/convencional") : ficha);
}
