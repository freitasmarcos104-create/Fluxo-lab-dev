// FLUXO LAB V5.12.0 — ponto de entrada único
// O Worker legado continua responsável por toda a aplicação existente.
// O Almoxarifado é interceptado aqui e compartilha autenticação, D1 e deploy oficiais.
import legado from "./legacy.js";
import { handleAlmoxarifado, integrarTelaAlmoxarifado, adaptarMeuEspacoAlmoxarife, injetarLinkAlmoxarifado, injetarGestaoEquipeAlmoxarifado, ehFuncionarioAlmoxarifado, deveBloquearRotaAlmoxarife } from "./modules/almoxarifado.js";
import { obterUsuarioLogado } from "./core/auth.js";

export default {
  ...legado,
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const rotaAlmoxarifado = url.pathname === "/almoxarifado" || url.pathname.startsWith("/almoxarifado/");
    if (rotaAlmoxarifado) {
      const respostaAlmox = await handleAlmoxarifado(request, env, url);
      const tipoAlmox = respostaAlmox?.headers?.get("content-type") || "";
      if (respostaAlmox?.status === 200 && tipoAlmox.includes("text/html")) {
        // Usa o layout real do Fluxo Lab como moldura da área. Nenhuma janela ou
        // identidade visual paralela é criada para o Almoxarifado.
        const shellUrl = new URL("/meu-perfil", request.url);
        const shellRequest = new Request(shellUrl, {
          method: "GET",
          headers: request.headers
        });
        const shellOriginal = await legado.fetch(shellRequest, env, ctx);
        const shell = await injetarLinkAlmoxarifado(shellOriginal, shellRequest, env);
        return integrarTelaAlmoxarifado(respostaAlmox, shell);
      }
      return respostaAlmox;
    }

    // Contas de funcionário vinculadas ao Almoxarifado entram diretamente no setor
    // e não podem acessar as páginas ou APIs gerais do laboratório.
    const usuario = await obterUsuarioLogado(request, env);
    const almoxarife = await ehFuncionarioAlmoxarifado(env, usuario);
    if (deveBloquearRotaAlmoxarife(almoxarife, url.pathname, request.method)) {
      if (url.pathname.includes("/api/")) {
        return new Response(JSON.stringify({ erro: "Acesso restrito ao setor Almoxarifado." }), {
          status: 403,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store, max-age=0",
            "X-Content-Type-Options": "nosniff"
          }
        });
      }
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/almoxarifado",
          "Cache-Control": "no-store, max-age=0",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    const response = await legado.fetch(request, env, ctx);
    const espacoColaborador = await adaptarMeuEspacoAlmoxarife(response, request, env);
    const comNavegacao = await injetarLinkAlmoxarifado(espacoColaborador, request, env);
    return injetarGestaoEquipeAlmoxarifado(comNavegacao, request, env);
  }
};
