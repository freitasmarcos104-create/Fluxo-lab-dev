import { ficha, progresso, estilos, etapas } from "./clinica-form.js";
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
    } else if (campo("acao") === "editar-paciente" || campo("acao") === "excluir-paciente") {
      const id = Number(campo("paciente"));
      if (campo("acao") === "editar-paciente") {
        const nome = campo("nome");
        if (!nome || nome.length > 100) return erro("Confira o nome do paciente.",400);
        const r = await db.prepare("UPDATE clinica_pacientes SET nome=? WHERE id=? AND usuario_id=? AND excluido_em IS NULL").bind(nome,id,usuario.id).run();
        if (!r.meta.changes) return erro("Paciente indisponível.",404);
      } else {
        const r = await db.prepare(`UPDATE clinica_pacientes SET excluido_em=? WHERE id=? AND usuario_id=? AND excluido_em IS NULL
          AND NOT EXISTS(SELECT 1 FROM trabalhos_clinica WHERE paciente_id=clinica_pacientes.id AND excluido_em IS NULL AND entregue_em IS NULL)`)
          .bind(new Date().toISOString(),id,usuario.id).run();
        if (!r.meta.changes) return erro("Paciente indisponível ou com trabalhos ativos. Confira os trabalhos antes de excluir o cadastro.",409);
      }
    } else if (campo("acao") === "entregar" || campo("acao") === "excluir") {
      const entregar = campo("acao") === "entregar";
      const sql = entregar ? "UPDATE trabalhos_clinica SET entregue_em=? WHERE andamento=8 AND entregue_em IS NULL" :
        "UPDATE trabalhos_clinica SET excluido_em=? WHERE 1=1";
      const r = await db.prepare(sql + " AND id=? AND usuario_id=? AND excluido_em IS NULL")
        .bind(new Date().toISOString(), Number(campo("id")), usuario.id).run();
      if (!r.meta.changes) return erro("Trabalho indisponível para esta ação.",409);
      if (entregar) destino = rota + "?vista=entregues";
    } else if (campo("acao") === "etapa") {
      const id = Number(campo("id")), atual = Number(campo("atual"));
      if (!Number.isSafeInteger(id) || id < 1 || !/^[0-8]$/.test(campo("atual"))) return erro("Etapa inválida.", 400);
      const seguinte = atual === 8 ? 7 : atual + 1;
      const resultado = await db.prepare("UPDATE trabalhos_clinica SET andamento=?, concluido=? WHERE usuario_id=? AND id=? AND andamento=? AND entregue_em IS NULL AND excluido_em IS NULL")
        .bind(seguinte, Number(seguinte===8), usuario.id, id, atual).run();
      if (!resultado.meta.changes) return erro("O caso está indisponível ou a etapa já foi atualizada. Volte à Clínica para conferir.", 409);
    } else if (campo("acao") === "criar") {
      const paciente = Number(campo("paciente")), prazo = campo("prazo");
      const observacoes = campo("observacoes"), chave = campo("chave");
      if (!Number.isSafeInteger(paciente) || paciente < 1 || observacoes.length > 1000 || !uuid.test(chave))
        return erro("Confira o paciente, o tipo e as observações do trabalho.", 400);
      if (prazo) {
        const data = new Date(prazo + "T00:00:00Z");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo) || !Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== prazo)
          return erro("Prazo inválido.", 400);
      }
      const registro = await db.prepare("SELECT nome FROM clinica_pacientes WHERE id=? AND usuario_id=? AND excluido_em IS NULL").bind(paciente,usuario.id).first();
      if (!registro) return erro("Paciente não encontrado.",404);
      const ids = form.has("item") ? form.getAll("item") : ["0"];
      if (new Set(ids).size !== ids.length || ids.some(id => !/^(0|[1-9][0-9]{0,8})$/.test(id))) return erro("Lista de trabalhos inválida.",400);
      const insercoes = [];
      for (const id of ids) {
        const sufixo = id === "0" ? "" : "_" + id;
        const tipo = campo("tipo" + sufixo);
        if (!tiposClinica.includes(tipo)) return erro("Selecione o tipo de cada trabalho.",400);
        const dentes = new Set(form.getAll("fdi" + sufixo));
        const arcadas = form.getAll("arcada" + sufixo);
        if ([...dentes].some(d => !/^[1-4][1-8]$/.test(d)) || arcadas.some(a => !["superior","inferior"].includes(a)))
          return erro("Seleção FDI inválida.", 400);
        for (const arcada of arcadas) {
          for (const q of arcada === "superior" ? [1,2] : [3,4]) {
            for (let i=1; i<=8; i++) dentes.add(String(q*10+i));
          }
        }
        if (!dentes.size) return erro("Selecione ao menos um dente ou uma arcada.", 400);
        insercoes.push(db.prepare(`INSERT INTO trabalhos_clinica (usuario_id,chave,referencia,tipo,prazo,observacoes,paciente_id,dentes)
          VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(usuario_id,chave) DO NOTHING`)
          .bind(usuario.id, id === "0" ? chave : chave + ":" + id, registro.nome, tipo, prazo || null, observacoes, paciente, [...dentes].sort().join(", ")));
      }
      await db.batch(insercoes);
    } else return erro("Ação inválida.", 400);
    return new Response(null, {status:303, headers:{Location:destino, "Cache-Control":"private, no-store"}});
  }
  if (request.method !== "GET") return erro("Método inválido.", 405);
  const antes = Number(url.searchParams.get("antes")) || Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(antes) || antes < 1) return erro("Página inválida.", 400);
  const vista = url.searchParams.get("vista") || "ativos";
  const filtros = {ativos:"t.excluido_em IS NULL AND t.entregue_em IS NULL", entregues:"t.excluido_em IS NULL AND t.entregue_em IS NOT NULL", excluidos:"t.excluido_em IS NOT NULL"};
  if (!Object.hasOwn(filtros,vista)) return erro("Lista inválida.",400);
  const {results} = await db.prepare(`SELECT t.*,COALESCE(p.nome,t.referencia) AS nome_exibido FROM trabalhos_clinica t
    LEFT JOIN clinica_pacientes p ON p.id=t.paciente_id AND p.usuario_id=t.usuario_id
    WHERE t.usuario_id=? AND t.id<? AND ${filtros[vista]} ORDER BY t.id DESC LIMIT 21`).bind(usuario.id, antes).all();
  const pacientes = await db.prepare("SELECT id,nome FROM clinica_pacientes WHERE usuario_id=? AND excluido_em IS NULL ORDER BY nome COLLATE NOCASE,id").bind(usuario.id).all();
  const eventos = await db.prepare("SELECT * FROM clinica_eventos WHERE trabalho_id IN (SELECT value FROM json_each(?)) ORDER BY id").bind(JSON.stringify(results.slice(0,20).map(x=>x.id))).all();
  function historico(id) {
    const eventosCaso = eventos.results.filter(e => e.trabalho_id === id);
    const rotulos = {criado:"Trabalho cadastrado",entregue:"Entrega registrada",excluido:"Trabalho excluído",reaberto:"Acabamento reaberto"};
    const linhas = eventosCaso.map(e => {
      const etapa = etapas[Math.floor((e.etapa-1)/2)];
      const texto = rotulos[e.evento] || (e.etapa%2 ? "Início de " : "Conclusão de ") + etapa;
      const data = new Date(e.criado_em).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"});
      return `<li>${data} · ${escapeHtml(texto)}</li>`;
    }).join("");
    return `<details><summary>Histórico do trabalho</summary>${linhas ? "<ol>"+linhas+"</ol>" : "<p>Ainda não há eventos registrados.</p>"}</details>`;
  }
  const gestao = pacientes.results.length ? `<details class="card"><summary>Editar ou excluir paciente</summary><form method="post"><label>Paciente<select name="paciente" required><option value="">Selecione</option>${pacientes.results.map(p=>`<option value="${p.id}">${escapeHtml(p.nome)} · #${p.id}</option>`).join("")}</select></label><label>Nome corrigido<input name="nome" maxlength="100"></label><button name="acao" value="editar-paciente">Salvar nome</button> <button class="botao-perigo" name="acao" value="excluir-paciente" onclick="return confirm('Excluir o cadastro deste paciente da Clínica?')">🗑️ Excluir paciente</button></form></details>` : "";
  function descricaoArcada(dentes) {
    const superior = /(?:^|, )[12][1-8]/.test(dentes);
    const inferior = /(?:^|, )[34][1-8]/.test(dentes);
    if (superior && inferior) return "Superior e inferior";
    return superior ? "Superior" : inferior ? "Inferior" : "";
  }
  const itens = results.slice(0,20).map(item => `<article class="card"><h3>${escapeHtml(item.nome_exibido)}</h3>
    <p><strong>${escapeHtml(item.tipo)}</strong> · ${descricaoArcada(item.dentes)}</p><p>${item.paciente_id ? "Paciente #" + item.paciente_id : "Referência anterior"} · FDI: ${escapeHtml(item.dentes || "sem registro")}</p>
    ${item.prazo ? `<p>Prazo de entrega: ${escapeHtml(item.prazo.split("-").reverse().join("/"))}</p>` : ""}
    ${item.observacoes ? `<p style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(item.observacoes)}</p>` : ""}
    ${progresso(item)}${historico(item.id)}
    ${item.excluido_em ? "" : `<details><summary>🗑️ Excluir trabalho</summary><p>Remover este trabalho de ${escapeHtml(item.nome_exibido)}? Os outros trabalhos do paciente continuam na lista.</p>
    <form method="post"><input type="hidden" name="id" value="${item.id}"><button class="botao-perigo" name="acao" value="excluir">Confirmar exclusão deste trabalho</button></form></details>`}</article>`).join("");
  return pagina(`${estilos}${ficha(pacientes.results,Number(url.searchParams.get("paciente")),tiposClinica,escapeHtml)}
    ${gestao}<nav aria-label="Listas da Clínica"><a class="botao" href="${rota}">Em produção</a> <a class="botao" href="${rota}?vista=entregues">Entregues</a> <a class="botao" href="${rota}?vista=excluidos">Lixeira</a></nav>
    <h2>${{ativos:"Meus trabalhos",entregues:"Histórico de entregas",excluidos:"Trabalhos excluídos"}[vista]}</h2>${itens || "<p>Nenhum trabalho nesta lista.</p>"}
    ${results.length > 20 ? `<a href="${rota}?vista=${vista}&amp;antes=${results[19].id}">Trabalhos anteriores</a>` : ""}
    ${url.searchParams.has("antes") ? `<a href="${rota}?vista=${vista}">Voltar aos mais recentes</a>` : ""}`);
}
