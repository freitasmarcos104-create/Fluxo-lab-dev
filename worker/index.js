// FLUXO LAB V5.11.0 — ponto de entrada único
// O Worker legado continua responsável por toda a aplicação existente.
// O Almoxarifado é interceptado aqui e compartilha autenticação, D1 e deploy oficiais.
import legado from "./legacy.js";
import { handleAlmoxarifado, injetarLinkAlmoxarifado, injetarGestaoEquipeAlmoxarifado, ehFuncionarioAlmoxarifado, deveRedirecionarAlmoxarife } from "./modules/almoxarifado.js";
import { obterUsuarioLogado } from "./core/auth.js";

export default {
  ...legado,
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const rotaAlmoxarifado = url.pathname === "/almoxarifado" || url.pathname.startsWith("/almoxarifado/");
    if (rotaAlmoxarifado) {
      return handleAlmoxarifado(request, env, url);
    }

    // Contas de funcionário vinculadas ao Almoxarifado entram diretamente no setor
    // e não podem acessar as páginas ou APIs gerais do laboratório.
    const usuario = await obterUsuarioLogado(request, env);
    const almoxarife = await ehFuncionarioAlmoxarifado(env, usuario);
    if (deveRedirecionarAlmoxarife(almoxarife, url.pathname, request.method)) {
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
    const comNavegacao = await injetarLinkAlmoxarifado(response, request);
    return injetarGestaoEquipeAlmoxarifado(comNavegacao, request, env);
  }
};
