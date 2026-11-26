const tipos = {
  PT: "Prótese total",
  PPR: "PPR flex",
  PLACA_BRUXISMO: "Placa de bruxismo",
  COROA: "Coroa",
  INLAY: "Inlay",
  FACETA: "Faceta",
  PROTOCOLO: "Protocolo"
};

const arcadas = ["SUPERIOR", "INFERIOR"];
const tipoTradicional = (tipo) => tipo === "PT" || tipo === "PPR";

export function lerTrabalhosMunicipais(form) {
  const selecoes = arcadas.map((arcada) => {
    const valores = form.getAll(arcada.toLowerCase() + "_tipo");
    return [...new Set(valores.map((tipo) => String(tipo).trim().toUpperCase()))]
      .filter((tipo) => tipo !== "NONE");
  });
  const itens = selecoes.flatMap((selecionados, i) =>
    selecionados.map((tipo) => ({ arcada: arcadas[i], tipo }))
  );
  if (!itens.length || itens.some(({ tipo }) => !Object.hasOwn(tipos, tipo))) return null;
  const porPeca = selecoes.some((selecionados) => selecionados.length > 1)
    || itens.some(({ tipo }) => !tipoTradicional(tipo));
  return { itens, porPeca, superior: selecoes[0][0] || "NONE", inferior: selecoes[1][0] || "NONE" };
}

export function camposTrabalhosMunicipais(permitirMultiplos) {
  return arcadas.map((arcada) => {
    const titulo = arcada === "SUPERIOR" ? "Arcada superior" : "Arcada inferior";
    const nome = arcada.toLowerCase() + "_tipo";
    if (!permitirMultiplos) {
      return `<label>${titulo}<select name="${nome}"><option value="NONE">Sem trabalho</option><option value="PT">Prótese total</option><option value="PPR">PPR flex</option></select></label>`;
    }
    const campos = Object.entries(tipos).map(([valor, rotulo]) =>
      `<label style="display:flex;gap:8px;align-items:center;margin:5px 0"><input style="width:auto;margin:0" type="checkbox" name="${nome}" value="${valor}">${rotulo}</label>`
    );
    return `<fieldset><legend>${titulo}</legend>${campos.join("")}</fieldset>`;
  }).join("");
}

export function sqlTiposMunicipais(alias) {
  return arcadas.map((arcada) => `(
    SELECT group_concat(tm.tipo, ',') FROM trabalhos_municipais tm
    WHERE tm.trabalho_id = ${alias}.id AND tm.arcada = '${arcada}'
  ) AS tipos_${arcada.toLowerCase()}`).join(",\n");
}

export function nomesTiposMunicipais(valores) {
  return String(valores || "").split(",").filter((tipo) => Object.hasOwn(tipos, tipo))
    .map((tipo) => tipoTradicional(tipo) ? tipo : tipos[tipo]);
}

export function sqlPecasMunicipaisConcluidas(alias) {
  return `NOT EXISTS (SELECT 1 FROM trabalhos_municipais tm
    WHERE tm.trabalho_id = ${alias}.id AND tm.concluido_em IS NULL)`;
}

export async function listarPecasMunicipais(db, trabalhoId) {
  const { results } = await db.prepare(`
    SELECT tm.*, u.nome AS designado_nome, i.nome AS iniciado_nome
    FROM trabalhos_municipais tm
    LEFT JOIN usuarios u ON u.id = tm.designado_para
    LEFT JOIN usuarios i ON i.id = tm.iniciado_por
    WHERE tm.trabalho_id = ?
    ORDER BY CASE tm.arcada WHEN 'SUPERIOR' THEN 0 ELSE 1 END, tm.id
  `).bind(trabalhoId).all();
  return results;
}

const funcionarioDigitalAtivo = `u.perfil = 'FUNCIONARIO' AND u.ativo = 1 AND u.excluido = 0
  AND EXISTS (SELECT 1 FROM usuario_areas ua WHERE ua.usuario_id = u.id AND ua.area = 'DIGITAL' AND ua.ativo = 1)
  AND EXISTS (SELECT 1 FROM usuario_setores us WHERE us.usuario_id = u.id AND us.area = 'DIGITAL' AND us.ativo = 1)`;

export async function listarDesignaveisMunicipais(db) {
  const { results } = await db.prepare(`
    SELECT u.id, u.nome FROM usuarios u WHERE ${funcionarioDigitalAtivo}
    ORDER BY u.nome COLLATE NOCASE, u.id
  `).all();
  return results;
}

function podeOperar(usuario, peca, gestao) {
  return gestao || (usuario.perfil === "FUNCIONARIO" && Number(peca.designado_para) === Number(usuario.id));
}

export function renderPecasMunicipais(pecas, usuario, { ativo, gestao, admin, equipe, escapeHtml }) {
  if (!pecas.length) return "";
  const funcionarios = equipe.map((u) => `<option value="${Number(u.id)}">${escapeHtml(u.nome)}</option>`).join("");
  const linhas = pecas.map((peca) => {
    const rota = `/trabalhos-municipais/${Number(peca.id)}`;
    const pode = ativo && podeOperar(usuario, peca, gestao);
    const status = peca.concluido_em ? "Concluído" : peca.iniciado_em ? "Em andamento"
      : peca.designado_para ? "Designado" : "Aguardando designação";
    let acoes = "";
    if (ativo && admin && !peca.iniciado_em && funcionarios) {
      acoes += `<form method="POST" action="${rota}/designar">
        <label>Funcionário<select name="funcionario_id" required><option value="">Selecione</option>${funcionarios}</select></label>
        <input type="hidden" name="designado_anterior" value="${Number(peca.designado_para || 0)}">
        <button>${peca.designado_para ? "Redesignar" : "Designar"}</button></form>`;
    }
    if (pode && !peca.concluido_em) {
      const acao = peca.iniciado_em ? "concluir" : "iniciar";
      acoes += `<form method="POST" action="${rota}/${acao}"><button>${peca.iniciado_em ? "Concluir" : "Iniciar"}</button></form>`;
    }
    const responsavel = peca.iniciado_nome || peca.designado_nome;
    return `<tr><td>${peca.arcada === "SUPERIOR" ? "Superior" : "Inferior"}</td><td>${tipos[peca.tipo]}</td>
      <td><strong>${status}</strong>${responsavel ? `<div class="mini">${escapeHtml(responsavel)}</div>` : ""}</td><td>${acoes}</td></tr>`;
  }).join("");
  return `<section class="card" id="trabalhos-municipais"><h3>Trabalhos por arcada</h3>
    <div class="tabela-wrap"><table><thead><tr><th>Arcada</th><th>Trabalho</th><th>Situação</th><th>Ações</th></tr></thead>
    <tbody>${linhas}</tbody></table></div></section>`;
}

export async function handleTrabalhosMunicipais(request, env, caminho, deps) {
  const rota = caminho.match(/^\/trabalhos-municipais\/(\d+)\/(designar|iniciar|concluir)$/);
  if (!rota || request.method !== "POST") return null;
  const { obterUsuarioLogado, redirect, textResponse, isAdmin, podeGerirPecasMunicipais,
    usuarioTemAreaDigital, registrarHistorico } = deps;
  const usuario = await obterUsuarioLogado(request, env);
  if (!usuario) return redirect("/");
  if (!usuarioTemAreaDigital(usuario)) return textResponse("Acesso negado.", 403);
  const id = Number(rota[1]);
  const acao = rota[2];
  const gestao = podeGerirPecasMunicipais(usuario);
  if (acao === "designar" ? !isAdmin(usuario) : !gestao && usuario.perfil !== "FUNCIONARIO") {
    return textResponse("Acesso negado.", 403);
  }
  const peca = await env.db.prepare(`
    SELECT tm.* FROM trabalhos_municipais tm JOIN trabalhos t ON t.id = tm.trabalho_id
    WHERE tm.id = ? AND t.excluido = 0
  `).bind(id).first();
  if (!peca) return textResponse("Trabalho não encontrado.", 404);
  const agora = new Date().toISOString();
  const aberto = `EXISTS (
    SELECT 1 FROM trabalhos t JOIN remessas r ON r.id = t.remessa_id
    WHERE t.id = trabalhos_municipais.trabalho_id AND t.excluido = 0 AND t.entregue = 0
      AND t.arquivado = 0 AND r.data_finalizacao IS NULL AND r.data_entrega_real IS NULL
  )`;
  let alteracao;
  let detalhe = `${peca.arcada} · ${tipos[peca.tipo]}`;
  if (acao === "designar") {
    const form = await request.formData();
    const funcionarioId = Number(form.get("funcionario_id"));
    const anterior = Number(form.get("designado_anterior") || 0);
    const funcionario = await env.db.prepare(`SELECT u.id, u.nome FROM usuarios u
      WHERE u.id = ? AND ${funcionarioDigitalAtivo}`).bind(funcionarioId).first();
    if (!funcionario) return textResponse("Selecione um funcionário ativo do Digital.", 400);
    alteracao = await env.db.prepare(`UPDATE trabalhos_municipais
      SET designado_para = ?, designado_por = ?, designado_em = ?
      WHERE id = ? AND iniciado_em IS NULL AND COALESCE(designado_para, 0) = ? AND ${aberto}
        AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = ? AND ${funcionarioDigitalAtivo})
    `).bind(funcionario.id, usuario.id, agora, id, anterior, funcionario.id).run();
    detalhe += ` · ${funcionario.nome}`;
  } else {
    if (!podeOperar(usuario, peca, gestao)) return textResponse("O trabalho precisa ser designado a você pelo administrador.", 403);
    const iniciar = acao === "iniciar";
    const colunas = iniciar ? "iniciado_por = ?, iniciado_em = ?" : "concluido_por = ?, concluido_em = ?";
    const estado = iniciar ? "iniciado_em IS NULL" : "iniciado_em IS NOT NULL AND concluido_em IS NULL";
    alteracao = await env.db.prepare(`UPDATE trabalhos_municipais SET ${colunas}
      WHERE id = ? AND ${estado} AND (? = 1 OR designado_para = ?) AND ${aberto}
    `).bind(usuario.id, agora, id, Number(gestao), usuario.id).run();
  }
  if (alteracao.meta?.changes !== 1) return textResponse("O trabalho mudou ou está indisponível. Atualize a ficha.", 409);
  await registrarHistorico(env, peca.trabalho_id, usuario.id, `PECA_MUNICIPAL_${acao.toUpperCase()}`, detalhe);
  return redirect(`/trabalhos/${peca.trabalho_id}#trabalhos-municipais`);
}

export async function painelPecasMunicipaisDesignadas(db, usuarioId, escapeHtml) {
  const { results } = await db.prepare(`
    SELECT tm.trabalho_id, tm.arcada, tm.tipo, tm.iniciado_em, t.paciente, r.municipio, r.numero
    FROM trabalhos_municipais tm
    JOIN trabalhos t ON t.id = tm.trabalho_id
    JOIN remessas r ON r.id = t.remessa_id
    WHERE tm.designado_para = ? AND tm.concluido_em IS NULL
      AND t.excluido = 0 AND t.entregue = 0 AND t.arquivado = 0
      AND r.data_finalizacao IS NULL AND r.data_entrega_real IS NULL
    ORDER BY tm.designado_em, tm.id
  `).bind(usuarioId).all();
  if (!results.length) return "";
  const itens = results.map((item) =>
    `<li><a href="/trabalhos/${Number(item.trabalho_id)}#trabalhos-municipais">${escapeHtml(item.paciente)}</a>
      · ${escapeHtml(item.municipio)}, remessa ${Number(item.numero)}
      · ${item.arcada === "SUPERIOR" ? "Superior" : "Inferior"} · ${tipos[item.tipo]}
      · ${item.iniciado_em ? "Em andamento" : "Liberado para iniciar"}</li>`
  );
  return `<section class="card"><h2>Trabalhos municipais designados a mim</h2><ul>${itens.join("")}</ul></section>`;
}
