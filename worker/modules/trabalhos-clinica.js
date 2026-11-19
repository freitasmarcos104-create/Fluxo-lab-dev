export const tiposClinica = [
  "Prótese total digital de alta qualidade", "Prótese parcial removível (PPR)",
  "Placa de bruxismo", "Coroa", "Ponte", "Faceta", "Onlay", "Inlay", "Prótese fixa"
];

const rota = "/trabalhos-clinica";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function trabalhosClinica(request, db, usuario, { layout, htmlResponse, escapeHtml }) {
  const url = new URL(request.url);
  const pagina = (conteudo, status = 200) => {
    const resposta = htmlResponse(layout(conteudo, "Trabalhos da Clínica", usuario), status);
    resposta.headers.set("Cache-Control", "private, no-store");
    return resposta;
  };
  const erro = (mensagem, status) => pagina(`<p class="erro">${mensagem}</p><a href="${rota}">Voltar à Clínica</a>`, status);
  if (request.method === "POST") {
    if (request.headers.get("Origin") !== url.origin) return erro("Origem inválida.", 403);
    const form = await request.formData();
    if (form.get("acao") === "status") {
      const id = Number(form.get("id"));
      const destino = form.get("concluido");
      if (!Number.isSafeInteger(id) || id <= 0 || !["0","1"].includes(destino)) return erro("Trabalho inválido.", 400);
      const resultado = await db.prepare("UPDATE trabalhos_clinica SET concluido=? WHERE usuario_id=? AND id=?")
        .bind(Number(destino), usuario.id, id).run();
      if (!resultado.meta.changes) return erro("Trabalho não encontrado.", 404);
    } else if (form.get("acao") === "criar") {
      const campo = nome => String(form.get(nome) ?? "").trim();
      const referencia = campo("referencia"), tipo = campo("tipo"), prazo = campo("prazo");
      const observacoes = campo("observacoes"), chave = campo("chave");
      if (!referencia || referencia.length > 100 || !tiposClinica.includes(tipo) || observacoes.length > 1000 || !uuid.test(chave))
        return erro("Confira a referência, o tipo e as observações do trabalho.", 400);
      if (prazo) {
        const data = new Date(prazo + "T00:00:00Z");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo) || !Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== prazo)
          return erro("Prazo inválido.", 400);
      }
      await db.prepare(`INSERT INTO trabalhos_clinica (usuario_id,chave,referencia,tipo,prazo,observacoes)
        VALUES (?,?,?,?,?,?) ON CONFLICT(usuario_id,chave) DO NOTHING`)
        .bind(usuario.id, chave, referencia, tipo, prazo || null, observacoes).run();
    } else return erro("Ação inválida.", 400);
    return new Response(null, {status:303, headers:{Location:rota, "Cache-Control":"private, no-store"}});
  }
  if (request.method !== "GET") return erro("Método inválido.", 405);
  const antes = Number(url.searchParams.get("antes")) || Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(antes) || antes < 1) return erro("Página inválida.", 400);
  const {results} = await db.prepare("SELECT id,referencia,tipo,prazo,observacoes,concluido FROM trabalhos_clinica WHERE usuario_id=? AND id<? ORDER BY id DESC LIMIT 21")
    .bind(usuario.id, antes).all();
  const itens = results.slice(0,20).map(item => `<article class="card"><h3>${escapeHtml(item.referencia)}</h3>
    <p>${escapeHtml(item.tipo)} · <strong>${item.concluido ? "Concluído" : "Em andamento"}</strong></p>
    ${item.prazo ? `<p>Prazo de entrega: ${escapeHtml(item.prazo.split("-").reverse().join("/"))}</p>` : ""}
    ${item.observacoes ? `<p style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(item.observacoes)}</p>` : ""}
    <form action="${rota}" method="post"><input type="hidden" name="acao" value="status">
    <input type="hidden" name="id" value="${item.id}"><input type="hidden" name="concluido" value="${item.concluido ? 0 : 1}">
    <button type="submit">${item.concluido ? "Reabrir trabalho" : "Marcar como concluído"}</button></form></article>`).join("");
  return pagina(`<section class="card"><h1>Trabalhos da Clínica</h1><p>Só você vê estes casos. Eles ficam fora das metas e da fila do laboratório.</p>
    <details><summary>Novo trabalho</summary><form method="post" action="${rota}">
    <input type="hidden" name="acao" value="criar"><input type="hidden" name="chave" value="${crypto.randomUUID()}">
    <label>Referência do caso<input name="referencia" maxlength="100" required></label>
    <label>Tipo de trabalho<select name="tipo" required><option value="">Selecione</option>${tiposClinica.map(t => `<option>${t}</option>`).join("")}</select></label>
    <label>Prazo de entrega (opcional)<input type="date" name="prazo"></label>
    <label>Observações (opcional)<textarea name="observacoes" maxlength="1000"></textarea></label>
    <button type="submit">Salvar trabalho</button></form></details></section>
    <h2>Meus trabalhos</h2>${itens || "<p>Nenhum trabalho nesta lista.</p>"}
    ${results.length > 20 ? `<a href="${rota}?antes=${results[19].id}">Trabalhos anteriores</a>` : ""}
    ${url.searchParams.has("antes") ? `<a href="${rota}">Voltar aos mais recentes</a>` : ""}`);
}
