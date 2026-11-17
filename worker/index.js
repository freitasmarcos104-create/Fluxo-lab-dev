// FLUXO LAB V5.10.0 — ponto de entrada único
// O Worker legado continua responsável por toda a aplicação existente.
// O Almoxarifado é interceptado aqui e compartilha autenticação, D1 e deploy oficiais.
import legado from "./legacy.js";
import { handleAlmoxarifado, injetarLinkAlmoxarifado } from "./modules/almoxarifado.js";

export default {
  ...legado,
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/almoxarifado" || url.pathname.startsWith("/almoxarifado/")) {
      return handleAlmoxarifado(request, env, url);
    }
    const response = await legado.fetch(request, env, ctx);
    return injetarLinkAlmoxarifado(response, request);
  }
};
