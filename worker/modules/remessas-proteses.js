export function selecaoProtesesRemessaV515(paciente) {
  const origem=[paciente?.superior_tipo,paciente?.inferior_tipo];
  const encontrados=new Set();
  for(const valor of origem) {
    let tipo=String(valor??"").trim().toUpperCase();
    if(!tipo || ["NONE","NENHUM","SEM TRABALHO","NULL","0","-"].includes(tipo))continue;
    if(tipo==="TOTAL")tipo="PT";
    encontrados.add(tipo.slice(0,48));
  }
  const ordem=(tipo)=>tipo==="PPR"?0:tipo==="PT"?1:2;
  return [...encontrados].sort((a,b)=>ordem(a)-ordem(b)||a.localeCompare(b,"pt-BR"));
}

export function rotuloSelecaoProtesesRemessaV515(paciente) {
  const tipos=selecaoProtesesRemessaV515(paciente);
  return tipos.length?tipos.join(" + "):"Sem prótese";
}

export function classificacaoProtesesRemessaV515(paciente) {
  const tipos=selecaoProtesesRemessaV515(paciente);
  return {tipos,pt:tipos.length===1&&tipos[0]==="PT",ppr:tipos.length===1&&tipos[0]==="PPR",combinado:tipos.includes("PT")&&tipos.includes("PPR")};
}

export function escaparHtmlProtesesV515(valor) {
  return String(valor??"").replace(/[&<>"']/g, caractere=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[caractere]));
}

export function renderBadgesProtesesRemessaV515(paciente) {
  const tipos=selecaoProtesesRemessaV515(paciente);
  const combinado=tipos.length>1;
  return `<span class="badge ${!tipos.length?"neutro":combinado?"andamento":"ok"}" style="display:inline-block;margin-top:4px;white-space:normal" aria-label="Próteses selecionadas: ${escaparHtmlProtesesV515(rotuloSelecaoProtesesRemessaV515(paciente))}">${escaparHtmlProtesesV515(rotuloSelecaoProtesesRemessaV515(paciente))}</span>`;
}

export function iniciarControlesProtesesRemessaV515(id) {
  const painel=document.getElementById(id);
  if(!painel)return;
  const modo=painel.querySelector("[data-modo-v515]");
  const botoes=[...painel.querySelectorAll("[data-filtro-v515]")];
  const resultado=painel.querySelector("[data-resultado-v515]");
  const vazio=painel.querySelector("[data-vazio-v515]");
  const lista=painel.querySelector("[data-lista-v515]");
  const agrupado=painel.querySelector("[data-agrupado-v515]");
  let filtro="todos";
  function aplicaFiltro(){
    const mostraGrupo=modo.value==="agrupado";
    lista.hidden=mostraGrupo;
    agrupado.hidden=!mostraGrupo;
    const caixas=mostraGrupo?agrupado:lista;
    let visiveis=0;
    for(const el of painel.querySelectorAll("[data-paciente-v515]")){
      const atende=filtro==="todos"||el.getAttribute("data-"+filtro+"-v515")==="1";
      el.hidden=!atende;
      if(atende && caixas.contains(el))visiveis++;
    }
    for(const grupo of agrupado.querySelectorAll("[data-grupo-v515]")){
      grupo.hidden=![...grupo.querySelectorAll("[data-paciente-v515]")].some(el=>!el.hidden);
    }
    for(const botao of botoes){
      const ativo=botao.getAttribute("data-filtro-v515")===filtro;
      botao.setAttribute("aria-pressed",String(ativo));
      botao.classList.toggle("botao-sec",!ativo);
    }
    resultado.textContent=visiveis+" paciente(s) nesta seleção.";
    vazio.hidden=visiveis!==0;
  }
  modo.addEventListener("change",aplicaFiltro);
  for(const botao of botoes)botao.addEventListener("click",()=>{
    filtro=botao.getAttribute("data-filtro-v515");
    aplicaFiltro();
  });
  aplicaFiltro();
}

export function renderPainelProtesesRemessaV515(pacientes, remessaId, opcoes={}) {
  const lista=Array.isArray(pacientes)?pacientes:[];
  const id="proteses-remessa-v515-"+Number(remessaId);
  const grupos=new Map();
  const contadores={todos:lista.length,pt:0,ppr:0,combinado:0};
  const flag=(p)=>{
    const c=classificacaoProtesesRemessaV515(p);
    if(c.pt)contadores.pt++;
    if(c.ppr)contadores.ppr++;
    if(c.combinado)contadores.combinado++;
    const dados=`data-paciente-v515 data-pt-v515="${c.pt?1:0}" data-ppr-v515="${c.ppr?1:0}" data-combinado-v515="${c.combinado?1:0}"`;
    return {c,dados};
  };
  const registros=lista.map(p=>{
    const selecao=rotuloSelecaoProtesesRemessaV515(p);
    if(!grupos.has(selecao))grupos.set(selecao,[]);
    const {dados}=flag(p);
    const nome=escaparHtmlProtesesV515(p.paciente);
    const codigo=escaparHtmlProtesesV515(p.codigo);
    const superior=escaparHtmlProtesesV515(p.superior_tipo||"—");
    const inferior=escaparHtmlProtesesV515(p.inferior_tipo||"—");
    const destino="/trabalhos/"+Number(p.id);
    const nomeVisivel=opcoes.permitirLinks?`<a href="${destino}">${nome}</a>`:nome;
    const nomeCompleto=`<strong>${nomeVisivel}</strong><div class="mini">${codigo}</div>`;
    const badge=renderBadgesProtesesRemessaV515(p);
    grupos.get(selecao).push(`<div class="fl-prot-paciente-v515" ${dados}><div>${nomeCompleto}</div><div>${badge}</div><div class="mini">Superior: ${superior} · Inferior: ${inferior}</div></div>`);
    return `<tr ${dados}><td>${nomeCompleto}</td><td>${badge}</td><td>${superior}</td><td>${inferior}</td></tr>`;
  });
  const ordenados=[...grupos.entries()].sort(([a],[b])=>{
    const ordem={PT:0,PPR:1,"PPR + PT":2};
    return (ordem[a]??3)-(ordem[b]??3)||a.localeCompare(b,"pt-BR");
  });
  const partesGrupo=ordenados.map(([nome,grupo])=>`<section class="card fl-prot-grupo-v515" data-grupo-v515><h4 style="margin:0 0 9px">${escaparHtmlProtesesV515(nome)} <span class="badge neutro">${grupo.length}</span></h4><div class="fl-prot-grupo-itens-v515">${grupo.join("")}</div></section>`).join("");
  const botoes=[["todos","Todos",contadores.todos],["pt","PT",contadores.pt],["ppr","PPR",contadores.ppr],["combinado","PPR + PT",contadores.combinado]].map(([chave,nome,valor])=>`<button class="botao ${chave==="todos"?"":"botao-sec"}" type="button" data-filtro-v515="${chave}" aria-pressed="${chave==="todos"}">${nome} <strong>${valor}</strong></button>`).join("");
  const js=`(${iniciarControlesProtesesRemessaV515.toString()})(${JSON.stringify(id)});`;
  return `<section id="${id}" class="fl-remessa-proteses-v515" aria-label="Próteses selecionadas na remessa">
    <style>
      .fl-remessa-proteses-v515{margin:12px 0 16px}
      .fl-remessa-proteses-v515 [hidden]{display:none!important}
      .fl-remessa-proteses-v515 .fl-prot-cab-v515{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .fl-remessa-proteses-v515 .fl-prot-filtros-v515{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}
      .fl-remessa-proteses-v515 .fl-prot-filtros-v515 .botao{margin:0;padding:8px 12px}
      .fl-remessa-proteses-v515 .fl-prot-grupos-v515{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:12px}
      .fl-remessa-proteses-v515 .fl-prot-grupo-itens-v515{display:grid;gap:8px}
      .fl-remessa-proteses-v515 .fl-prot-paciente-v515{display:grid;gap:5px;padding:10px;border:1px solid var(--borda,#39454f);border-radius:9px}
      .fl-remessa-proteses-v515 .fl-prot-grupo-v515{margin:0}
      .fl-remessa-proteses-v515 .tabela-wrap table{width:100%}
      .fl-remessa-proteses-v515 select{min-width:170px}
    </style>
    <div class="fl-prot-cab-v515"><div><h3 style="margin:0 0 4px">Próteses selecionadas por paciente</h3><p class="nota" style="margin:0">Cada pessoa é contabilizada uma vez; combinações usam as arcadas superior e inferior já cadastradas.</p></div>
      <label style="margin:0">Modo de visualização<select data-modo-v515 aria-label="Modo de visualização das próteses"><option value="lista">Lista / badges (padrão)</option><option value="agrupado">Agrupado por seleção</option></select></label>
    </div>
    <div class="fl-prot-filtros-v515" role="group" aria-label="Filtros rápidos de próteses">${botoes}</div>
    <p class="mini" data-resultado-v515 aria-live="polite">${lista.length} paciente(s) nesta seleção.</p>
    <div class="tabela-wrap" data-lista-v515><table><thead><tr><th>Paciente</th><th>Prótese(s)</th><th>Superior</th><th>Inferior</th></tr></thead><tbody>${registros.join("")}</tbody></table></div>
    <div class="fl-prot-grupos-v515" data-agrupado-v515 hidden>${partesGrupo}</div>
    <p class="nota" data-vazio-v515 ${lista.length?"hidden":""}>Nenhum paciente corresponde a este filtro.</p>
    <script>${js}</script>
  </section>`;
}
