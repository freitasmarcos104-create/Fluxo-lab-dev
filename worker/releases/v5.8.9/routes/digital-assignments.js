// FLUXO LAB V4.6.0 — ROTAS DE DESIGNAÇÃO DIGITAL
// Controlador separado do despachante principal. Preserva caminhos, validações, permissões e respostas.
// Regras de atribuição permanecem nas funções de domínio já existentes.

export async function handleDigitalAssignmentsRoutesV46(request, env, url, caminho, deps) {
  const {
    obterUsuarioLogado, redirect, podeGerenciarAreaV31, textResponse,
    setorDigitalValidoV322, obterCicloDigitalV311,
    listarCiclosDesignacaoDigitalV322, listarRemessasDesignacaoDigitalV322,
    listarFuncionariosSetorDigitalV322, listarTrabalhosDesignacaoDigitalV322,
    htmlResponse, paginaDesignacoesDigitaisV322, aplicarDesignacaoLoteDigitalV322
  } = deps;
  const metodo = request.method;

  if (metodo === "GET" && caminho === "/digital/designacoes") {
    const usuario=await obterUsuarioLogado(request,env); if(!usuario) return redirect("/");
    if(!podeGerenciarAreaV31(usuario,"DIGITAL")) return textResponse("Acesso restrito à gestão Digital.",403);
    const setorSolicitado=String(url.searchParams.get("setor")||"CAD/CAM").toUpperCase();
    const setor=setorDigitalValidoV322(setorSolicitado)?setorSolicitado:"CAD/CAM";
    const cicloId=Number(url.searchParams.get("ciclo")||0);
    const ciclo=await obterCicloDigitalV311(env,cicloId);
    const cicloEfetivo=Number(ciclo?.id||0);
    const remessaId=Number(url.searchParams.get("remessa")||0);
    const busca=String(url.searchParams.get("q")||"").trim();
    const [ciclos,remessas,funcionarios,trabalhos]=await Promise.all([
      listarCiclosDesignacaoDigitalV322(env),
      listarRemessasDesignacaoDigitalV322(env,cicloEfetivo),
      listarFuncionariosSetorDigitalV322(env,setor),
      listarTrabalhosDesignacaoDigitalV322(env,setor,cicloEfetivo,remessaId,busca)
    ]);
    return htmlResponse(paginaDesignacoesDigitaisV322(usuario,{setor,ciclo,ciclos,remessas,funcionarios,trabalhos,remessaId,busca},url.searchParams.get("ok")||url.searchParams.get("erro")||"",url.searchParams.get("erro")?"erro":"sucesso"));
  }

  if (metodo === "POST" && caminho === "/digital/designacoes/lote") {
    const usuario=await obterUsuarioLogado(request,env); if(!usuario) return redirect("/");
    if(!podeGerenciarAreaV31(usuario,"DIGITAL")) return textResponse("Acesso restrito à gestão Digital.",403);
    const form=await request.formData();
    const setor=String(form.get("setor")||"").toUpperCase();
    const funcionarioId=Number(form.get("funcionario_id")||0);
    const acao=String(form.get("acao")||"ATRIBUIR").toUpperCase();
    const trabalhoIds=form.getAll("trabalho_id");
    const motivo=String(form.get("motivo")||"").trim().slice(0,300);
    const ciclo=Number(form.get("ciclo")||0),remessa=Number(form.get("remessa")||0),q=String(form.get("q")||"").trim();
    const voltar=()=>`/digital/designacoes?setor=${encodeURIComponent(setor||"CAD/CAM")}&ciclo=${encodeURIComponent(ciclo||"")}&remessa=${encodeURIComponent(remessa||"")}&q=${encodeURIComponent(q)}`;
    try{
      if(!["ATRIBUIR","REDESIGNAR","REMOVER"].includes(acao)) throw new Error("Ação de designação inválida.");
      const r=await aplicarDesignacaoLoteDigitalV322(env,usuario,setor,funcionarioId,trabalhoIds,acao,motivo);
      const msg=acao==="REMOVER"
        ? `Designação removida de ${r.pacientesAlterados} paciente(s). ${r.ignorados?`${r.ignorados} sem alteração.`:""}`
        : acao==="REDESIGNAR"
          ? `${r.pacientesAlterados} paciente(s) redesignado(s) antes do início. ${r.unidadesAlteradas} unidade(s) pendente(s) atualizada(s).${r.ignorados?` ${r.ignorados} bloqueado(s) ou sem alteração.`:""}`
          : `${r.pacientesAlterados} paciente(s) designado(s). ${r.unidadesAlteradas} unidade(s) pendente(s) atualizada(s).${r.ignorados?` ${r.ignorados} já designado(s) ou sem alteração.`:""}`;
      return redirect(`${voltar()}&ok=${encodeURIComponent(msg)}`);
    }catch(err){return redirect(`${voltar()}&erro=${encodeURIComponent(String(err?.message||"Falha ao designar trabalhos."))}`);}
  }

  return null;
}