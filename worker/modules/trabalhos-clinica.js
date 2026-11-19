import { ficha, progresso, estilos } from "./clinica-form.js";
export const tiposClinica = [
  "Prótese total digital de alta qualidade", "Prótese parcial removível (PPR)",
  "Placa de bruxismo", "Coroa", "Ponte", "Faceta", "Onlay", "Inlay", "Prótese fixa"
];

const rota = "/trabalhos-clinica";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function podeAcessarClinica(usuario) {
  return usuario?.perfil === "ADMINISTRADOR";
}

export async function trabalhosClinica(request, db, usuario, { layout, htmlResponse, escapeHtml }) {
  const url = new URL(request.url);
  const pagina = (conteudo, status = 200) => {
    const resposta = htmlResponse(layout(conteudo, "Trabalhos da Clínica", usuario), status);
    resposta.headers.set("Cache-Control", "private, no-store");
    return resposta;
  };
  const erro = (mensagem, status) => pagina(`<p class="erro">${mensagem}</p><a href="${rota}">Voltar à Clínica</a>`, status);
  if (!podeAcessarClinica(usuario)) return pagina('<p class="erro">Acesso exclusivo do administrador.</p>', 403);
  if (request.method === "POST") {
    if (request.headers.get("Origin") !== url.origin) return erro("Origem inválida.", 403);
    const form = await request.formData();
    const campo = nome => String(form.get(nome) ?? "").trim();
    let destino = rota;
    if (campo("acao") === "paciente") {
      const nome = campo("nome"), chave = campo("chave");
      if (!nome || nome.length > 100 || !uuid.test(chave)) return erro("Confira o nome do paciente.", 400);
      await db.prepare("INSERT INTO clinica_pacientes(usuario_id,nome,chave) VALUES(?,?,?) ON CONFLICT(usuario_id,chave) DO NOTHING")
        .bind(usuario.id,nome,chave).run();
      const paciente = await db.prepare("SELECT id FROM clinica_pacientes WHERE usuario_id=? AND chave=?").bind(usuario.id,chave).first();
      destino = rota + "?paciente=" + paciente.id;
    } else if (campo("acao") === "etapa") {
      const id = Number(campo("id")), atual = Number(campo("atual"));
      if (!Number.isSafeInteger(id) || id < 1 || !/^[0-8]$/.test(campo("atual"))) return erro("Etapa inválida.", 400);
      const seguinte = atual === 8 ? 7 : atual + 1;
      const resultado = await db.prepare("UPDATE trabalhos_clinica SET andamento=?, concluido=? WHERE usuario_id=? AND id=? AND andamento=?")
        .bind(seguinte, Number(seguinte===8), usuario.id, id, atual).run();
      if (!resultado.meta.changes) return erro("O caso está indisponível ou a etapa já foi atualizada. Volte à Clínica para conferir.", 409);
    } else if (campo("acao") === "criar") {
      const paciente = Number(campo("paciente")), tipo = campo("tipo"), prazo = campo("prazo");
      const dentes = new Set(form.getAll("fdi"));
      const arcadas = form.getAll("arcada");
      if ([...dentes].some(d => !/^[1-4][1-8]$/.test(d)) || arcadas.some(a => !["superior","inferior"].includes(a)))
        return erro("Seleção FDI inválida.", 400);
      for (const arcada of arcadas) {
        for (const q of arcada === "superior" ? [1,2] : [3,4]) {
          for (let i=1; i<=8; i++) dentes.add(String(q*10+i));
        }
      }
      if (!dentes.size) return erro("Selecione ao menos um dente ou uma arcada.", 400);
      const observacoes = campo("observacoes"), chave = campo("chave");
      if (!Number.isSafeInteger(paciente) || paciente < 1 || !tiposClinica.includes(tipo) || observacoes.length > 1000 || !uuid.test(chave))
        return erro("Confira o paciente, o tipo e as observações do trabalho.", 400);
      if (prazo) {
        const data = new Date(prazo + "T00:00:00Z");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo) || !Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== prazo)
          return erro("Prazo inválido.", 400);
      }
      const registro = await db.prepare("SELECT nome FROM clinica_pacientes WHERE id=? AND usuario_id=?").bind(paciente,usuario.id).first();
      if (!registro) return erro("Paciente não encontrado.",404);
      await db.prepare(`INSERT INTO trabalhos_clinica (usuario_id,chave,referencia,tipo,prazo,observacoes,paciente_id,dentes)
        VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(usuario_id,chave) DO NOTHING`)
        .bind(usuario.id, chave, registro.nome, tipo, prazo || null, observacoes, paciente, [...dentes].sort().join(", ")).run();
    } else return erro("Ação inválida.", 400);
    return new Response(null, {status:303, headers:{Location:destino, "Cache-Control":"private, no-store"}});
  }
  if (request.method !== "GET") return erro("Método inválido.", 405);
  const antes = Number(url.searchParams.get("antes")) || Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(antes) || antes < 1) return erro("Página inválida.", 400);
  const {results} = await db.prepare("SELECT id,referencia,tipo,prazo,observacoes,dentes,andamento,paciente_id FROM trabalhos_clinica WHERE usuario_id=? AND id<? ORDER BY id DESC LIMIT 21")
    .bind(usuario.id, antes).all();
  const pacientes = await db.prepare("SELECT id,nome FROM clinica_pacientes WHERE usuario_id=? ORDER BY nome COLLATE NOCASE,id").bind(usuario.id).all();
  const itens = results.slice(0,20).map(item => `<article class="card"><h3>${escapeHtml(item.referencia)}</h3>
    <p>${escapeHtml(item.tipo)}</p><p>${item.paciente_id ? "Paciente #" + item.paciente_id : "Referência anterior"} · FDI: ${escapeHtml(item.dentes || "sem registro")}</p>
    ${item.prazo ? `<p>Prazo de entrega: ${escapeHtml(item.prazo.split("-").reverse().join("/"))}</p>` : ""}
    ${item.observacoes ? `<p style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(item.observacoes)}</p>` : ""}
    ${progresso(item)}</article>`).join("");
  return pagina(`${estilos}${ficha(pacientes.results,Number(url.searchParams.get("paciente")),tiposClinica,escapeHtml)}
    <h2>Meus trabalhos</h2>${itens || "<p>Nenhum trabalho nesta lista.</p>"}
    ${results.length > 20 ? `<a href="${rota}?antes=${results[19].id}">Trabalhos anteriores</a>` : ""}
    ${url.searchParams.has("antes") ? `<a href="${rota}">Voltar aos mais recentes</a>` : ""}`);
}
