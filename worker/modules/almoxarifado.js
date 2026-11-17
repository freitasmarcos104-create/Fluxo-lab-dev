import { obterUsuarioLogado, criarHashSenha } from "../core/auth.js";
import { cabecalhosSegurancaV30, htmlResponse } from "../core/http.js";

const TIPOS_ITEM = ["REAGENTE", "PADRAO", "CONSUMIVEL", "KIT", "VIDRARIA", "EPI"];
const UNIDADES = ["mL", "g", "un"];
const STATUS_LOTE = ["DISPONIVEL", "QUARENTENA", "BLOQUEADO"];
const SETORES_DIGITAIS = ["CAD/CAM", "FATIAMENTO", "IMPRESSAO", "ACABAMENTO"];
const SETORES_CONVENCIONAIS = ["ARTICULACAO", "MONTAGEM", "ENCERRAMENTO", "ESCULTURA", "INCLUSAO", "ACRILIZACAO", "DESINCLUSAO", "ACABAMENTO", "QUALIDADE"];
const SETORES_VALIDOS = [
  ...SETORES_DIGITAIS.map((setor) => "DIGITAL:" + setor),
  ...SETORES_CONVENCIONAIS.map((setor) => "CONVENCIONAL:" + setor),
  "GERAL"
];

function gerenteAlmox(user) {
  return ["ADMINISTRADOR", "COORDENADOR"].includes(String(user?.perfil || "").toUpperCase());
}

export async function podeGerenciarAlmox(env, user) {
  if (!user) return false;
  if (gerenteAlmox(user)) return true;
  const vinculo = await primeiro(env.db, `
    SELECT 1
    FROM almoxarifado_equipe ae
    INNER JOIN usuarios u ON u.id=ae.usuario_id
    WHERE ae.usuario_id=? AND ae.funcao='ALMOXARIFE' AND ae.ativo=1
      AND u.ativo=1 AND u.excluido=0 AND u.perfil='FUNCIONARIO'
    LIMIT 1
  `, Number(user.id));
  return Boolean(vinculo);
}

export function escaparHtmlAlmox(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

export function sinalMovimentoAlmox(tipo) {
  if (["ENTRADA", "AJUSTE_POSITIVO"].includes(tipo)) return 1;
  if (["SAIDA", "PERDA", "VENCIMENTO", "AJUSTE_NEGATIVO"].includes(tipo)) return -1;
  return 0;
}

function respostaJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: cabecalhosSegurancaV30("application/json; charset=UTF-8")
  });
}

function respostaHtml(html, status = 200) {
  return htmlResponse(html, status);
}

function redirecionar(destino) {
  return new Response(null, {
    status: 303,
    headers: { ...cabecalhosSegurancaV30("text/plain; charset=UTF-8"), Location: destino }
  });
}

function numeroPositivo(value, label = "Quantidade") {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 1000000000) throw new Error(label + " deve ser maior que zero.");
  return n;
}

export function setoresDisponiveisAlmox(user) {
  if (gerenteAlmox(user)) return [...SETORES_VALIDOS];
  const atribuicoes = String(user?.setores_v31 || "")
    .split("|")
    .map((valor) => valor.trim().toUpperCase())
    .filter((valor) => SETORES_VALIDOS.includes(valor));
  if (atribuicoes.length) return [...new Set(atribuicoes)];
  const convencional = String(user?.setor_convencional || "").trim().toUpperCase();
  if (SETORES_CONVENCIONAIS.includes(convencional)) return ["CONVENCIONAL:" + convencional];
  const direto = String(user?.setor || "").trim().toUpperCase();
  if (SETORES_DIGITAIS.includes(direto)) return ["DIGITAL:" + direto];
  if (SETORES_CONVENCIONAIS.includes(direto)) return ["CONVENCIONAL:" + direto];
  if (direto === "IMPRESSÃO") return ["DIGITAL:IMPRESSAO"];
  return ["GERAL"];
}

function rotuloSetorAlmox(valor) {
  if (valor === "GERAL") return "Geral / sem setor específico";
  const [area, setor] = String(valor).split(":");
  const nomes = {
    ARTICULACAO: "Articulação", MONTAGEM: "Montagem", ENCERRAMENTO: "Encerramento",
    ESCULTURA: "Escultura", INCLUSAO: "Inclusão", ACRILIZACAO: "Acrilização",
    DESINCLUSAO: "Desinclusão", QUALIDADE: "Qualidade", IMPRESSAO: "Impressão"
  };
  return (nomes[setor] || setor) + (area === "DIGITAL" ? " · Digital" : " · Convencional");
}

function nomeSetor(user, solicitado) {
  const disponiveis = setoresDisponiveisAlmox(user);
  const setor = String(solicitado || disponiveis[0] || "GERAL").trim().toUpperCase();
  if (!disponiveis.includes(setor)) throw new Error("O setor selecionado não está vinculado à sua conta.");
  return setor;
}

async function primeiro(db, sql, ...params) {
  return db.prepare(sql).bind(...params).first();
}

async function todos(db, sql, ...params) {
  const result = await db.prepare(sql).bind(...params).all();
  return result?.results || [];
}

async function executar(db, sql, ...params) {
  return db.prepare(sql).bind(...params).run();
}

async function lerJson(request) {
  try { return await request.json(); }
  catch { throw new Error("Envie os dados em JSON válido."); }
}

async function criarItem(env, user, body) {
  const tipo = String(body.tipo || "").toUpperCase();
  const unidade = String(body.unidade || "");
  if (!TIPOS_ITEM.includes(tipo)) throw new Error("Tipo de item inválido.");
  if (!UNIDADES.includes(unidade)) throw new Error("A unidade deve ser mL, g ou un.");
  const codigo = String(body.codigo || "").trim().toUpperCase().slice(0, 40);
  const nome = String(body.nome || "").trim().slice(0, 120);
  const local = String(body.local_padrao || "").trim().slice(0, 100);
  const minimo = Number(body.quantidade_minima ?? 0);
  const controlaLote = ["REAGENTE", "PADRAO", "KIT"].includes(tipo) || Boolean(body.controla_lote);
  if (!codigo || !nome || !local) throw new Error("Código, nome e local padrão são obrigatórios.");
  if (!Number.isFinite(minimo) || minimo < 0) throw new Error("O estoque mínimo não pode ser negativo.");
  await executar(env.db,
    "INSERT INTO almoxarifado_itens (codigo,nome,tipo,unidade,local_padrao,quantidade_minima,controla_lote,criado_por) VALUES (?,?,?,?,?,?,?,?)",
    codigo, nome, tipo, unidade, local, minimo, controlaLote ? 1 : 0, user.id);
}

async function receberMaterial(env, user, body) {
  const itemId = Number(body.item_id);
  const quantidade = numeroPositivo(body.quantidade);
  const item = await primeiro(env.db, "SELECT * FROM almoxarifado_itens WHERE id=? AND ativo=1", itemId);
  if (!item) throw new Error("Item não encontrado ou inativo.");
  let codigoLote = String(body.codigo_lote || "").trim().slice(0, 80);
  let validade = String(body.validade || "").trim() || null;
  if (item.controla_lote) {
    if (!codigoLote || !validade) throw new Error("Este item exige número de lote e validade.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validade)) throw new Error("Validade inválida.");
  } else {
    codigoLote = "INT-" + Date.now() + "-" + crypto.randomUUID().slice(0, 8);
    validade = null;
  }
  const local = String(body.localizacao || item.local_padrao).trim().slice(0, 100);
  const situacao = String(body.status || "DISPONIVEL").toUpperCase();
  if (!local || !["DISPONIVEL", "QUARENTENA"].includes(situacao)) throw new Error("Local ou situação de recebimento inválidos.");
  const fornecedor = String(body.fornecedor || "").trim().slice(0, 120) || null;
  const documento = String(body.documento_entrada || "").trim().slice(0, 100) || null;
  const recebidoEm = String(body.recebido_em || new Date().toISOString().slice(0, 10));
  let lote = await primeiro(env.db, "SELECT * FROM almoxarifado_lotes WHERE item_id=? AND codigo_lote=?", itemId, codigoLote);
  if (lote) {
    if ((lote.validade || null) !== validade) throw new Error("O lote já existe com outra validade. Confira o cadastro antes de receber.");
    if (String(lote.localizacao) !== local) throw new Error("O lote já está cadastrado em outro local. Faça uma transferência registrada.");
  } else {
    const result = await executar(env.db,
      "INSERT INTO almoxarifado_lotes (item_id,codigo_lote,validade,localizacao,status,fornecedor,documento_entrada,recebido_em,criado_por) VALUES (?,?,?,?,?,?,?,?,?)",
      itemId, codigoLote, validade, local, situacao, fornecedor, documento, recebidoEm, user.id);
    const loteId = Number(result?.meta?.last_row_id || 0);
    lote = await primeiro(env.db, "SELECT * FROM almoxarifado_lotes WHERE id=?", loteId);
  }
  if (!lote) throw new Error("Não foi possível registrar o lote.");
  await executar(env.db,
    "INSERT INTO almoxarifado_movimentos (item_id,lote_id,tipo,quantidade,origem_tipo,origem_id,local_destino,motivo,usuario_id) VALUES (?,?, 'ENTRADA', ?, 'RECEBIMENTO', ?, ?, ?, ?)",
    itemId, lote.id, quantidade, documento, local, "Recebimento de material", user.id);
}

async function criarRequisicao(env, user, body) {
  const itemId = Number(body.item_id);
  const quantidade = numeroPositivo(body.quantidade);
  const item = await primeiro(env.db, "SELECT id FROM almoxarifado_itens WHERE id=? AND ativo=1", itemId);
  if (!item) throw new Error("Selecione um item ativo.");
  const observacao = String(body.observacao || "").trim().slice(0, 300) || null;
  const setor = nomeSetor(user, body.setor);
  const result = await executar(env.db,
    "INSERT INTO almoxarifado_requisicoes (solicitante_id,setor,observacao) VALUES (?,?,?)",
    user.id, setor, observacao);
  const requisicaoId = Number(result?.meta?.last_row_id || 0);
  if (!requisicaoId) throw new Error("Não foi possível abrir a requisição.");
  await executar(env.db,
    "INSERT INTO almoxarifado_requisicao_itens (requisicao_id,item_id,quantidade_solicitada) VALUES (?,?,?)",
    requisicaoId, itemId, quantidade);
}

async function atenderRequisicao(env, user, body) {
  const lineId = Number(body.requisicao_item_id);
  const loteId = Number(body.lote_id);
  const quantidade = numeroPositivo(body.quantidade);
  const linha = await primeiro(env.db,
    "SELECT ri.*,r.id AS requisicao_id,r.status AS status_manual FROM almoxarifado_requisicao_itens ri JOIN almoxarifado_requisicoes r ON r.id=ri.requisicao_id WHERE ri.id=?",
    lineId);
  if (!linha || linha.status_manual === "CANCELADA") throw new Error("Requisição não encontrada ou cancelada.");
  const lote = await primeiro(env.db,
    "SELECT s.*,l.status AS status_real,l.validade AS validade_real FROM almoxarifado_saldos_lotes s JOIN almoxarifado_lotes l ON l.id=s.lote_id WHERE s.lote_id=? AND s.item_id=? AND s.saldo>0",
    loteId, linha.item_id);
  if (!lote) throw new Error("Lote não encontrado ou sem saldo disponível.");
  await executar(env.db,
    "INSERT INTO almoxarifado_movimentos (item_id,lote_id,tipo,quantidade,origem_tipo,origem_id,requisicao_item_id,motivo,usuario_id) VALUES (?,?, 'SAIDA', ?, 'REQUISICAO', ?, ?, ?, ?)",
    linha.item_id, loteId, quantidade, linha.requisicao_id, lineId, "Atendimento da requisição #" + linha.requisicao_id, user.id);
}

async function ajustarInventario(env, user, body) {
  const loteId = Number(body.lote_id);
  const contado = Number(body.quantidade_contada);
  const motivo = String(body.motivo || "").trim().slice(0, 300);
  if (!Number.isFinite(contado) || contado < 0) throw new Error("A quantidade contada não pode ser negativa.");
  if (motivo.length < 4) throw new Error("Informe o motivo do ajuste.");
  const lote = await primeiro(env.db, "SELECT s.*,l.status AS status_real FROM almoxarifado_saldos_lotes s JOIN almoxarifado_lotes l ON l.id=s.lote_id WHERE s.lote_id=?", loteId);
  if (!lote) throw new Error("Lote não encontrado.");
  const diferenca = Number((contado - Number(lote.saldo)).toFixed(6));
  if (Math.abs(diferenca) < 0.000001) return;
  await executar(env.db,
    "INSERT INTO almoxarifado_movimentos (item_id,lote_id,tipo,quantidade,origem_tipo,origem_id,motivo,usuario_id) VALUES (?,?,?,?, 'INVENTARIO', ?, ?, ?)",
    lote.item_id, loteId, diferenca > 0 ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO", Math.abs(diferenca), "CONTAGEM FÍSICA", motivo, user.id);
}

async function registrarMovimentoEspecial(env, user, body) {
  const loteId = Number(body.lote_id);
  const quantidade = numeroPositivo(body.quantidade);
  const tipo = String(body.tipo || "").toUpperCase();
  const motivo = String(body.motivo || "").trim().slice(0, 300);
  if (!["PERDA", "VENCIMENTO", "TRANSFERENCIA"].includes(tipo)) throw new Error("Tipo de movimento inválido.");
  if (motivo.length < 4) throw new Error("Informe o motivo do movimento.");
  const lote = await primeiro(env.db, "SELECT s.*,l.localizacao AS local_atual FROM almoxarifado_saldos_lotes s JOIN almoxarifado_lotes l ON l.id=s.lote_id WHERE s.lote_id=?", loteId);
  if (!lote) throw new Error("Lote não encontrado.");
  if (tipo === "TRANSFERENCIA") {
    if (lote.status_lote !== "DISPONIVEL" || (lote.validade && lote.validade < new Date().toISOString().slice(0, 10))) {
      throw new Error("Somente lote disponível e dentro da validade pode ser transferido.");
    }
    if (Math.abs(quantidade - Number(lote.saldo)) > 0.000001) {
      throw new Error("A transferência desta versão move o lote inteiro, pois cada lote possui uma única localização.");
    }
    const destino = String(body.local_destino || "").trim().slice(0, 100);
    if (!destino || destino === lote.local_atual) throw new Error("Informe um local de destino diferente do atual.");
    await env.db.batch([
      env.db.prepare("INSERT INTO almoxarifado_movimentos (item_id,lote_id,tipo,quantidade,origem_tipo,local_origem,local_destino,motivo,usuario_id) VALUES (?,?, 'TRANSFERENCIA', ?, 'TRANSFERENCIA', ?, ?, ?, ?)").bind(lote.item_id, loteId, quantidade, lote.local_atual, destino, motivo, user.id),
      env.db.prepare("UPDATE almoxarifado_lotes SET localizacao=? WHERE id=?").bind(destino, loteId)
    ]);
    return;
  }
  await executar(env.db,
    "INSERT INTO almoxarifado_movimentos (item_id,lote_id,tipo,quantidade,origem_tipo,motivo,usuario_id) VALUES (?,?,?,?,'OPERACAO',?,?)",
    lote.item_id, loteId, tipo, quantidade, motivo, user.id);
}

async function alterarStatusLote(env, body) {
  const loteId = Number(body.lote_id);
  const status = String(body.status || "").toUpperCase();
  if (!STATUS_LOTE.includes(status)) throw new Error("Situação inválida.");
  const lote = await primeiro(env.db, "SELECT id,validade FROM almoxarifado_lotes WHERE id=?", loteId);
  if (!lote) throw new Error("Lote não encontrado.");
  if (status === "DISPONIVEL" && lote.validade && lote.validade < new Date().toISOString().slice(0, 10)) {
    throw new Error("Lote vencido não pode voltar a ficar disponível.");
  }
  await executar(env.db, "UPDATE almoxarifado_lotes SET status=? WHERE id=?", status, loteId);
}

async function dadosItens(env, busca = "") {
  const termo = String(busca || "").trim().toLowerCase();
  return todos(env.db,
    "SELECT i.*,COALESCE(SUM(s.saldo),0) AS saldo_total,COALESCE(SUM(CASE WHEN s.status_lote='DISPONIVEL' AND (s.validade IS NULL OR s.validade>=date('now')) THEN s.saldo ELSE 0 END),0) AS saldo_disponivel FROM almoxarifado_itens i LEFT JOIN almoxarifado_saldos_lotes s ON s.item_id=i.id WHERE i.ativo=1 AND (?='' OR lower(i.codigo) LIKE ? OR lower(i.nome) LIKE ?) GROUP BY i.id ORDER BY i.nome COLLATE NOCASE",
    termo, "%" + termo + "%", "%" + termo + "%");
}

async function dadosLotes(env, itemId = 0) {
  const filtro = Number(itemId) > 0 ? " AND s.item_id=?" : "";
  const params = Number(itemId) > 0 ? [Number(itemId)] : [];
  return todos(env.db,
    "SELECT s.*,i.codigo,i.nome,i.unidade,i.controla_lote,CASE WHEN s.status_lote='BLOQUEADO' THEN 'BLOQUEADO' WHEN s.status_lote='QUARENTENA' THEN 'QUARENTENA' WHEN s.status_lote='VENCIDO' THEN 'VENCIDO' WHEN s.validade IS NOT NULL AND s.validade<date('now') THEN 'VENCIDO' ELSE 'DISPONIVEL' END AS status_exibicao FROM almoxarifado_saldos_lotes s JOIN almoxarifado_itens i ON i.id=s.item_id WHERE 1=1" + filtro + " ORDER BY CASE WHEN s.validade IS NULL THEN 1 ELSE 0 END,s.validade ASC,s.recebido_em ASC,s.lote_id ASC",
    ...params);
}

async function dadosRequisicoes(env) {
  return todos(env.db,
    "SELECT r.id AS requisicao_id,r.solicitante_id,r.setor,r.observacao,r.criado_em,u.nome AS solicitante,ri.id AS requisicao_item_id,ri.item_id,ri.quantidade_solicitada,i.codigo,i.nome AS item_nome,i.unidade,COALESCE((SELECT SUM(m.quantidade) FROM almoxarifado_movimentos m WHERE m.requisicao_item_id=ri.id AND m.tipo='SAIDA'),0) AS quantidade_atendida,CASE WHEN r.status='CANCELADA' THEN 'CANCELADA' WHEN COALESCE((SELECT SUM(m.quantidade) FROM almoxarifado_movimentos m WHERE m.requisicao_item_id=ri.id AND m.tipo='SAIDA'),0)>=ri.quantidade_solicitada THEN 'ATENDIDA' WHEN COALESCE((SELECT SUM(m.quantidade) FROM almoxarifado_movimentos m WHERE m.requisicao_item_id=ri.id AND m.tipo='SAIDA'),0)>0 THEN 'PARCIAL' ELSE 'ABERTA' END AS status FROM almoxarifado_requisicoes r JOIN almoxarifado_requisicao_itens ri ON ri.requisicao_id=r.id JOIN almoxarifado_itens i ON i.id=ri.item_id LEFT JOIN usuarios u ON u.id=r.solicitante_id ORDER BY r.id DESC,ri.id ASC LIMIT 250");
}

async function dadosMovimentos(env) {
  return todos(env.db,
    "SELECT m.*,i.codigo,i.nome AS item_nome,i.unidade,l.codigo_lote,u.nome AS usuario_nome FROM almoxarifado_movimentos m JOIN almoxarifado_itens i ON i.id=m.item_id JOIN almoxarifado_lotes l ON l.id=m.lote_id LEFT JOIN usuarios u ON u.id=m.usuario_id ORDER BY m.id DESC LIMIT 200");
}

async function dadosPainel(env) {
  const results = await Promise.all([
    primeiro(env.db, "SELECT COUNT(*) AS total FROM almoxarifado_itens WHERE ativo=1"),
    primeiro(env.db, "SELECT COUNT(*) AS total FROM almoxarifado_saldos_itens WHERE saldo_disponivel<quantidade_minima"),
    primeiro(env.db, "SELECT COUNT(*) AS total FROM almoxarifado_status_requisicoes WHERE status IN ('ABERTA','PARCIAL')"),
    dadosLotes(env)
  ]);
  const hoje = new Date().toISOString().slice(0, 10);
  const expira = (dias) => {
    const limite = new Date();
    limite.setDate(limite.getDate() + dias);
    const ate = limite.toISOString().slice(0, 10);
    return results[3].filter((l) => Number(l.saldo) > 0 && l.validade && l.validade >= hoje && l.validade <= ate && l.status_exibicao === "DISPONIVEL").length;
  };
  return {
    itens: Number(results[0]?.total || 0),
    abaixo_minimo: Number(results[1]?.total || 0),
    requisicoes_abertas: Number(results[2]?.total || 0),
    vencendo_30: expira(30), vencendo_60: expira(60), vencendo_90: expira(90)
  };
}

function classeStatus(value) {
  const v = String(value || "").toUpperCase();
  if (["DISPONIVEL", "ATENDIDA", "NORMAL"].includes(v)) return "ok";
  if (["QUARENTENA", "PARCIAL", "ABERTA", "ABAIXO DO MÍNIMO"].includes(v)) return "alerta";
  return "bloqueio";
}

function selItens(itens) {
  return '<option value="">Selecione um item</option>' + itens.map((item) =>
    '<option value="' + item.id + '">' + escaparHtmlAlmox(item.codigo + " · " + item.nome + " (" + item.unidade + ")") + "</option>"
  ).join("");
}

function renderTabelaItens(itens) {
  if (!itens.length) return '<p class="vazio">Nenhum item cadastrado.</p>';
  return '<div class="tabela-wrap"><table><thead><tr><th>Código</th><th>Item</th><th>Tipo</th><th>Disponível</th><th>Total físico</th><th>Mínimo</th><th>Controle</th><th>Situação</th></tr></thead><tbody>' +
    itens.map((item) => {
      const saldo = Number(item.saldo_disponivel || 0);
      const total = Number(item.saldo_total || 0);
      const minimo = Number(item.quantidade_minima || 0);
      const status = saldo <= 0 ? "SEM ESTOQUE DISPONÍVEL" : saldo < minimo ? "ABAIXO DO MÍNIMO" : "NORMAL";
      return '<tr><td>' + escaparHtmlAlmox(item.codigo) + '</td><td><a href="/almoxarifado?view=item&id=' + item.id + '">' + escaparHtmlAlmox(item.nome) +
        '</a></td><td>' + escaparHtmlAlmox(item.tipo) + '</td><td class="numero">' + saldo + " " + escaparHtmlAlmox(item.unidade) +
        '</td><td class="numero">' + total + " " + escaparHtmlAlmox(item.unidade) + '</td><td class="numero">' + minimo +
        '</td><td>' + (item.controla_lote ? "Lote e validade" : "Lote interno") +
        '</td><td><span class="status ' + classeStatus(status) + '">' + status + "</span></td></tr>";
    }).join("") + "</tbody></table></div>";
}

function renderTabelaLotes(lotes, gerente) {
  if (!lotes.length) return '<p class="vazio">Nenhum lote registrado.</p>';
  return '<div class="tabela-wrap"><table><thead><tr><th>Item</th><th>Lote</th><th>Validade</th><th>Local</th><th>Saldo</th><th>Situação</th>' +
    (gerente ? "<th>Controle</th>" : "") + '</tr></thead><tbody>' +
    lotes.map((l) => '<tr><td>' + escaparHtmlAlmox(l.codigo + " · " + l.nome) + '</td><td>' +
      escaparHtmlAlmox(l.codigo_lote + (l.controla_lote ? "" : " · interno")) + '</td><td>' + escaparHtmlAlmox(l.validade || "—") +
      '</td><td>' + escaparHtmlAlmox(l.localizacao) + '</td><td class="numero">' + Number(l.saldo || 0) + " " +
      escaparHtmlAlmox(l.unidade) + '</td><td><span class="status ' + classeStatus(l.status_exibicao) + '">' + escaparHtmlAlmox(l.status_exibicao) +
      "</span></td>" + (gerente ? '<td><form class="linha-form" method="POST" action="/almoxarifado/acao"><input type="hidden" name="acao" value="status_lote">' +
      '<input type="hidden" name="lote_id" value="' + l.lote_id + '"><select name="status" required><option value="">Alterar situação...</option><option value="DISPONIVEL">Disponível</option>' +
      '<option value="QUARENTENA">Quarentena</option><option value="BLOQUEADO">Bloqueado</option></select><button class="secundario">Salvar</button></form></td>' : "") +
      "</tr>"
    ).join("") + "</tbody></table></div>";
}

function renderTabelaMovimentos(movimentos) {
  if (!movimentos.length) return '<p class="vazio">Ainda não existem movimentos.</p>';
  return '<div class="tabela-wrap"><table><thead><tr><th>Data</th><th>Item</th><th>Lote</th><th>Movimento</th><th>Quantidade</th><th>Origem</th><th>Local</th><th>Usuário</th><th>Motivo</th></tr></thead><tbody>' +
    movimentos.map((m) => '<tr><td>' + escaparHtmlAlmox(m.criado_em) + '</td><td>' + escaparHtmlAlmox(m.codigo + " · " + m.item_nome) +
      '</td><td>' + escaparHtmlAlmox(m.codigo_lote) + '</td><td>' + escaparHtmlAlmox(m.tipo) + '</td><td class="numero">' +
      Number(m.quantidade) + " " + escaparHtmlAlmox(m.unidade) + '</td><td>' + escaparHtmlAlmox(m.origem_tipo || "—") +
      '</td><td>' + escaparHtmlAlmox([m.local_origem,m.local_destino].filter(Boolean).join(" → ") || "—") +
      '</td><td>' + escaparHtmlAlmox(m.usuario_nome || "—") + '</td><td>' + escaparHtmlAlmox(m.motivo || "—") + "</td></tr>"
    ).join("") + "</tbody></table></div>";
}

function renderRequisicoes(requisicoes, lotes, gerente) {
  if (!requisicoes.length) return '<p class="vazio">Nenhuma requisição registrada.</p>';
  return '<div class="lista-requisicoes">' + requisicoes.map((r) => {
    const restante = Math.max(0, Number(r.quantidade_solicitada) - Number(r.quantidade_atendida));
    const disponiveis = lotes.filter((l) => Number(l.item_id) === Number(r.item_id) && Number(l.saldo) > 0 && l.status_exibicao === "DISPONIVEL");
    const opcoes = disponiveis.map((l) => '<option value="' + l.lote_id + '">' + escaparHtmlAlmox(
      l.codigo_lote + (l.controla_lote ? "" : " · interno") + " · vence " + (l.validade || "sem validade") + " · saldo " + l.saldo + " " + l.unidade
    ) + "</option>").join("");
    return '<article class="requisicao"><div><strong>Requisição #' + r.requisicao_id + " · " + escaparHtmlAlmox(r.item_nome) +
      '</strong><span class="status ' + classeStatus(r.status) + '">' + escaparHtmlAlmox(r.status) + "</span></div><p>Solicitante: " +
      escaparHtmlAlmox(r.solicitante || "Usuário") + " · Setor: " + escaparHtmlAlmox(r.setor) + " · Pedido: " +
      Number(r.quantidade_solicitada) + " " + escaparHtmlAlmox(r.unidade) + " · Atendido: " + Number(r.quantidade_atendida) +
      " · Restante: " + restante + "</p>" + (r.observacao ? "<p>" + escaparHtmlAlmox(r.observacao) + "</p>" : "") +
      (gerente && restante > 0 ? '<form class="linha-form" method="POST" action="/almoxarifado/acao"><input type="hidden" name="acao" value="atender">' +
        '<input type="hidden" name="requisicao_item_id" value="' + r.requisicao_item_id + '"><select name="lote_id" required>' +
        '<option value="">Lote sugerido (FEFO)</option>' + opcoes + "</select>" +
        '<input name="quantidade" type="number" min="0.001" max="' + restante + '" step="0.001" value="' + restante + '" required>' +
        '<button>Confirmar saída</button></form>' : "") + "</article>";
  }).join("") + "</div>";
}

function formularioItem() {
  return '<form class="form-grid" method="POST" action="/almoxarifado/acao"><input type="hidden" name="acao" value="criar_item">' +
    '<label>Código<input name="codigo" maxlength="40" required></label><label>Nome<input name="nome" maxlength="120" required></label>' +
    '<label>Tipo<select name="tipo" required>' + TIPOS_ITEM.map((t) => '<option value="' + t + '">' + t + "</option>").join("") + '</select></label>' +
    '<label>Unidade única<select name="unidade"><option>un</option><option>mL</option><option>g</option></select></label>' +
    '<label>Local padrão<input name="local_padrao" maxlength="100" required placeholder="Ex.: Armário A"></label>' +
    '<label>Estoque mínimo<input name="quantidade_minima" type="number" min="0" step="0.001" value="0" required></label>' +
    '<p class="muted">Reagentes, padrões e kits exigem lote e validade automaticamente. Os demais tipos podem ativar esse controle.</p>' +
    '<label class="checkbox"><input type="checkbox" name="controla_lote" value="1"> Controla lote e validade para este item</label>' +
    '<div class="acoes"><button>Cadastrar item</button></div></form>';
}

function formularioEntrada(itens) {
  return '<form class="form-grid" method="POST" action="/almoxarifado/acao"><input type="hidden" name="acao" value="receber">' +
    '<label class="largo">Item<select name="item_id" required>' + selItens(itens) + '</select></label>' +
    '<label>Número do lote<input name="codigo_lote" maxlength="80" placeholder="Obrigatório para item rastreado"></label>' +
    '<label>Validade<input name="validade" type="date"></label><label>Quantidade recebida<input name="quantidade" type="number" min="0.001" step="0.001" required></label>' +
    '<label>Localização<input name="localizacao" maxlength="100" placeholder="Usa o local padrão se vazio"></label><label>Fornecedor<input name="fornecedor" maxlength="120"></label>' +
    '<label>Nota / documento<input name="documento_entrada" maxlength="100"></label><label>Data de recebimento<input name="recebido_em" type="date" value="' +
    new Date().toISOString().slice(0, 10) + '"></label><label>Situação<select name="status"><option value="DISPONIVEL">Conferido · disponível</option>' +
    '<option value="QUARENTENA">Aguardando conferência · quarentena</option></select></label><div class="acoes"><button>Registrar entrada</button></div></form>';
}

function formularioRequisicao(itens, user) {
  const setores = setoresDisponiveisAlmox(user);
  const opcoesSetor = setores.map((setor) => '<option value="' + escaparHtmlAlmox(setor) + '">' +
    escaparHtmlAlmox(rotuloSetorAlmox(setor)) + "</option>").join("");
  return '<form class="form-grid" method="POST" action="/almoxarifado/acao"><input type="hidden" name="acao" value="requisitar">' +
    '<label>Setor<select name="setor" required>' + (setores.length > 1 ? '<option value="">Selecione seu setor</option>' : "") +
    opcoesSetor + '</select></label>' +
    '<label class="largo">Material<select name="item_id" required>' + selItens(itens) + '</select></label>' +
    '<label>Quantidade<input name="quantidade" type="number" min="0.001" step="0.001" required></label>' +
    '<label class="largo">Observação / finalidade<input name="observacao" maxlength="300" placeholder="Onde ou para que será usado?"></label>' +
    '<div class="acoes"><button>Enviar requisição</button></div></form>';
}

function formularioOperacao(lotes) {
  return '<form class="form-grid" method="POST" action="/almoxarifado/acao"><input type="hidden" name="acao" value="movimento_especial">' +
    '<label class="largo">Lote<select name="lote_id" required><option value="">Selecione o lote</option>' +
    lotes.filter((l) => Number(l.saldo) > 0).map((l) => '<option value="' + l.lote_id + '">' +
      escaparHtmlAlmox(l.nome + " · " + l.codigo_lote + " · saldo " + l.saldo + " " + l.unidade + " · " + l.localizacao) + "</option>"
    ).join("") + '</select></label><label>Operação<select name="tipo"><option value="PERDA">Perda</option>' +
    '<option value="VENCIMENTO">Vencimento / descarte</option><option value="TRANSFERENCIA">Transferência de local</option></select></label>' +
    '<label>Quantidade<input name="quantidade" type="number" min="0.001" step="0.001" required></label>' +
    '<label>Local de destino (transferência)<input name="local_destino" maxlength="100"></label>' +
    '<label class="largo">Motivo<input name="motivo" minlength="4" maxlength="300" required></label><div class="acoes"><button>Registrar movimento</button></div></form>';
}

function formularioInventario(lotes) {
  if (!lotes.length) return '<p class="vazio">Nenhum lote para contagem.</p>';
  return '<div class="tabela-wrap"><table><thead><tr><th>Item</th><th>Lote</th><th>Local</th><th>Saldo do sistema</th><th>Contagem física / motivo</th></tr></thead><tbody>' +
    lotes.map((l) => '<tr><td>' + escaparHtmlAlmox(l.nome) + '</td><td>' + escaparHtmlAlmox(l.codigo_lote) + '</td><td>' +
      escaparHtmlAlmox(l.localizacao) + '</td><td>' + Number(l.saldo) + " " + escaparHtmlAlmox(l.unidade) + '</td><td><form class="linha-form" method="POST" action="/almoxarifado/acao">' +
      '<input type="hidden" name="acao" value="ajustar_inventario"><input type="hidden" name="lote_id" value="' + l.lote_id + '">' +
      '<input name="quantidade_contada" type="number" min="0" step="0.001" value="' + Number(l.saldo) + '" required>' +
      '<input name="motivo" minlength="4" maxlength="300" placeholder="Motivo da diferença" required><button class="secundario">Conferir</button></form></td></tr>'
    ).join("") + "</tbody></table></div>";
}

function layoutAlmox(user, view, content, gerente, notice = "") {
  const links = [["dashboard","Painel"],["itens","Itens"],["entrada","Entrada"],["requisicoes","Requisições"],["lotes","Lotes"],["movimentos","Movimentos"],["inventario","Inventário"]];
  const nav = links.map(([key,label]) => '<a class="' + (view === key ? "ativo" : "") + '" href="/almoxarifado?view=' + key + '">' + label + "</a>").join("");
  const css = [
    ":root{color-scheme:light;--ink:#17233b;--muted:#62708a;--line:#e3e9f2;--paper:#f4f7fb;--blue:#2872c8;--blue2:#e8f1ff;--green:#157347;--yellow:#946200;--red:#b42318}",
    "*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.5 Inter,system-ui,-apple-system,Segoe UI,sans-serif}",
    ".top{background:#fff;border-bottom:1px solid var(--line);padding:18px max(22px,calc((100% - 1240px)/2));display:flex;align-items:center;justify-content:space-between;gap:16px}",
    ".brand{display:flex;align-items:center;gap:12px}.logo{width:40px;height:40px;border-radius:12px;background:var(--blue2);color:var(--blue);display:grid;place-items:center;font-size:21px;font-weight:800}.brand strong{display:block;font-size:18px}.brand small{color:var(--muted)}",
    ".top a{color:var(--blue);text-decoration:none;font-weight:650}.wrap{max-width:1240px;margin:24px auto;padding:0 22px}.intro{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:18px}.intro h1{font-size:26px;margin:0 0 4px}.intro p{margin:0;color:var(--muted)}",
    "nav{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 20px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:7px}nav a{padding:9px 13px;text-decoration:none;color:#45536a;border-radius:9px;font-weight:650}nav a.ativo{background:var(--blue2);color:var(--blue)}",
    ".grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}.card,.panel{background:#fff;border:1px solid var(--line);border-radius:15px;padding:17px;box-shadow:0 2px 10px #182a4408}.card small{display:block;color:var(--muted)}.card strong{display:block;font-size:26px;margin-top:5px}.panel{margin-bottom:17px}.panel h2{margin:0 0 13px;font-size:18px}.muted{color:var(--muted)}",
    ".form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.form-grid label{display:flex;flex-direction:column;gap:5px;font-weight:650;color:#35425a}.form-grid .largo{grid-column:span 2}.form-grid input,.form-grid select,.linha-form input,.linha-form select{min-width:0;width:100%;border:1px solid #cfd8e6;border-radius:8px;padding:10px;background:#fff;color:var(--ink);font:inherit}.form-grid .checkbox{display:flex;flex-direction:row;align-items:center;gap:8px}.checkbox input{width:auto}.acoes{grid-column:1/-1;display:flex;justify-content:flex-end}",
    "button{border:0;border-radius:8px;background:var(--blue);color:#fff;font-weight:700;padding:10px 16px;cursor:pointer}button.secundario{background:#edf2f8;color:#263750}.notice{margin-bottom:16px;padding:12px 15px;border-radius:10px;background:#eaf5ef;color:#17613b}.vazio{color:var(--muted);padding:12px 0}",
    ".tabela-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:720px}th,td{text-align:left;padding:11px 9px;border-bottom:1px solid var(--line);vertical-align:middle}th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);background:#f9fbfe}td a{color:var(--blue);font-weight:700;text-decoration:none}.numero{text-align:right;font-variant-numeric:tabular-nums}",
    ".status{display:inline-flex;padding:4px 8px;border-radius:100px;font-size:11px;font-weight:800;background:#eef2f7;color:#45536a}.status.ok{background:#e7f6ee;color:var(--green)}.status.alerta{background:#fff4d6;color:var(--yellow)}.status.bloqueio{background:#fdebea;color:var(--red)}",
    ".lista-requisicoes{display:grid;gap:10px}.requisicao{border:1px solid var(--line);border-radius:11px;padding:14px}.requisicao>div{display:flex;align-items:center;gap:10px;justify-content:space-between}.requisicao p{margin:7px 0;color:var(--muted)}.linha-form{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.linha-form input,.linha-form select{width:auto;min-width:140px;flex:1}.linha-form button{white-space:nowrap}.requisicao .linha-form{margin-top:10px}",
    ".detail{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.detail div{background:#f7f9fc;padding:12px;border-radius:9px}.detail small{display:block;color:var(--muted)}.detail strong{font-size:18px}",
    "@media(max-width:800px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.top{padding:14px 18px}.wrap{padding:0 14px}.intro h1{font-size:22px}}@media(max-width:520px){.grid{grid-template-columns:1fr 1fr;gap:8px}.card{padding:12px}.form-grid{grid-template-columns:1fr}.form-grid .largo{grid-column:span 1}.intro{align-items:start;flex-direction:column}.top{align-items:flex-start;flex-direction:column}.detail{grid-template-columns:1fr}}"
  ].join("");
  const titulo = (links.find((entry) => entry[0] === view) || ["","Almoxarifado"])[1];
  return "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Almoxarifado · Fluxo Lab</title><style>" +
    css + "</style></head><body><header class=\"top\"><div class=\"brand\"><div class=\"logo\">▤</div><div><strong>Fluxo Lab · Almoxarifado</strong><small>Controle rastreável de materiais</small></div></div><div><a href=\"/\">Voltar ao Fluxo Lab</a> · " +
    escaparHtmlAlmox(user.nome || "Usuário") + "</div></header><main class=\"wrap\"><div class=\"intro\"><div><h1>" + titulo +
    "</h1><p>O saldo é calculado pelo histórico de movimentos. Não existe edição manual de estoque.</p></div>" +
    (gerente ? "<span class=\"status ok\">Gestão de estoque</span>" : "<span class=\"status\">Solicitante</span>") +
    "</div><nav aria-label=\"Navegação do almoxarifado\">" + nav + "</nav>" +
    (notice ? '<div class="notice">' + escaparHtmlAlmox(notice) + "</div>" : "") + content + "</main></body></html>";
}

async function renderView(env, user, url) {
  const view = String(url.searchParams.get("view") || "dashboard");
  const gerente = await podeGerenciarAlmox(env,user);
  const itens = await dadosItens(env,url.searchParams.get("q"));
  const lotes = await dadosLotes(env);
  let content = "";
  let requisicoes = [];
  const notice = String(url.searchParams.get("ok") || url.searchParams.get("erro") || "");
  if (view === "dashboard") {
    const painel = await dadosPainel(env);
    const abaixo = itens.filter((i) => Number(i.saldo_disponivel) < Number(i.quantidade_minima));
    const vencendo = lotes.filter((l) => Number(l.saldo) > 0 && l.validade && l.validade >= new Date().toISOString().slice(0, 10) &&
      l.validade <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) && l.status_exibicao === "DISPONIVEL");
    content = '<div class="grid">' +
      [["Itens ativos", painel.itens],["Abaixo do mínimo",painel.abaixo_minimo],["Requisições abertas",painel.requisicoes_abertas],["Vencendo em 30 dias",painel.vencendo_30]].map((x) =>
        '<div class="card"><small>' + x[0] + "</small><strong>" + x[1] + "</strong></div>").join("") +
      '</div><section class="panel"><h2>Alertas de validade</h2><div class="detail"><div><small>Até 30 dias</small><strong>' +
      painel.vencendo_30 + '</strong></div><div><small>Até 60 dias</small><strong>' + painel.vencendo_60 +
      '</strong></div><div><small>Até 90 dias</small><strong>' + painel.vencendo_90 + '</strong></div></div>' +
      (vencendo.length ? renderTabelaLotes(vencendo,false) : '<p class="vazio">Nenhum lote disponível vence nos próximos 30 dias.</p>') +
      '</section><section class="panel"><h2>Itens abaixo do mínimo</h2>' + renderTabelaItens(abaixo) + '</section>';
    requisicoes = (await dadosRequisicoes(env)).filter((r) => ["ABERTA","PARCIAL"].includes(r.status)).slice(0,8);
    content += '<section class="panel"><h2>Requisições pendentes</h2>' + renderRequisicoes(requisicoes,lotes,gerente) + '</section>';
  } else if (view === "itens") {
    const busca = String(url.searchParams.get("q") || "");
    content = (gerente ? '<section class="panel"><h2>Novo item</h2>' + formularioItem() + '</section>' : "") +
      '<section class="panel"><h2>Catálogo de materiais</h2><form class="linha-form" method="GET" action="/almoxarifado">' +
      '<input type="hidden" name="view" value="itens"><input name="q" value="' + escaparHtmlAlmox(busca) +
      '" placeholder="Buscar por código ou nome"><button>Buscar</button></form><br>' + renderTabelaItens(itens) + '</section>';
  } else if (view === "entrada") {
    content = gerente ? '<section class="panel"><h2>Registrar recebimento</h2><p class="muted">O material conferido entra como disponível. Material pendente de checagem entra em quarentena.</p>' +
      formularioEntrada(itens) + '</section>' : '<section class="panel"><p>Entrada de materiais restrita à administração e coordenação.</p></section>';
  } else if (view === "requisicoes") {
    requisicoes = await dadosRequisicoes(env);
    content = '<section class="panel"><h2>Solicitar material</h2>' + formularioRequisicao(itens,user) + '</section>' +
      '<section class="panel"><h2>Pedidos registrados</h2>' + renderRequisicoes(requisicoes,lotes,gerente) + '</section>';
  } else if (view === "lotes") {
    content = '<section class="panel"><h2>Lotes e saldos</h2><p class="muted">Sugestão de atendimento ordenada por FEFO. Lotes vencidos, em quarentena ou bloqueados não podem ser usados em saídas comuns.</p>' +
      renderTabelaLotes(lotes,gerente) + '</section>';
  } else if (view === "movimentos") {
    content = (gerente ? '<section class="panel"><h2>Perda, vencimento ou transferência</h2>' + formularioOperacao(lotes) + '</section>' : "");
    content += '<section class="panel"><h2>Histórico imutável</h2>' + renderTabelaMovimentos(await dadosMovimentos(env)) + '</section>';
  } else if (view === "inventario") {
    content = gerente ? '<section class="panel"><h2>Contagem física e ajuste</h2><p class="muted">Informe o saldo contado. A diferença será registrada como movimento de ajuste com o motivo, sem apagar o histórico.</p>' +
      formularioInventario(lotes) + '</section>' : '<section class="panel"><p>Inventário restrito à administração e coordenação.</p></section>';
  } else if (view === "item") {
    const itemId = Number(url.searchParams.get("id") || 0);
    const item = itens.find((x) => Number(x.id) === itemId);
    if (!item) content = '<section class="panel"><p>Item não encontrado.</p></section>';
    else {
      const lotesItem = lotes.filter((x) => Number(x.item_id) === itemId);
      const movs = (await dadosMovimentos(env)).filter((x) => Number(x.item_id) === itemId);
      content = '<section class="panel"><h2>' + escaparHtmlAlmox(item.codigo + " · " + item.nome) + '</h2><div class="detail">' +
        '<div><small>Saldo disponível</small><strong>' + Number(item.saldo_disponivel) + " " + escaparHtmlAlmox(item.unidade) + '</strong></div>' +
        '<div><small>Saldo físico total</small><strong>' + Number(item.saldo_total) + " " + escaparHtmlAlmox(item.unidade) + '</strong></div>' +
        '<div><small>Estoque mínimo</small><strong>' + Number(item.quantidade_minima) + " " + escaparHtmlAlmox(item.unidade) + '</strong></div>' +
        '<div><small>Local padrão</small><strong>' + escaparHtmlAlmox(item.local_padrao) + '</strong></div>' +
        '<div><small>Rastreabilidade</small><strong>' + (item.controla_lote ? "Lote e validade" : "Lote interno") + '</strong></div>' +
        '</div></section><section class="panel"><h2>Lotes</h2>' + renderTabelaLotes(lotesItem,gerente) +
        '</section><section class="panel"><h2>Histórico de movimentos</h2>' + renderTabelaMovimentos(movs) + '</section>';
    }
  } else {
    content = '<section class="panel"><p>Área não encontrada.</p></section>';
  }
  return respostaHtml(layoutAlmox(user,view,content,gerente,notice));
}

async function processarFormulario(request, env, user) {
  const form = await request.formData();
  const action = String(form.get("acao") || "");
  const get = (key) => String(form.get(key) ?? "").trim();
  if (!(await podeGerenciarAlmox(env,user)) && action !== "requisitar") throw new Error("Ação restrita aos responsáveis do Almoxarifado.");
  if (action === "criar_item") {
    await criarItem(env,user,{codigo:get("codigo"),nome:get("nome"),tipo:get("tipo"),unidade:get("unidade"),local_padrao:get("local_padrao"),quantidade_minima:get("quantidade_minima"),controla_lote:form.get("controla_lote")==="1"});
    return "/almoxarifado?view=itens&ok=" + encodeURIComponent("Item cadastrado.");
  }
  if (action === "receber") {
    await receberMaterial(env,user,{item_id:get("item_id"),codigo_lote:get("codigo_lote"),validade:get("validade"),quantidade:get("quantidade"),localizacao:get("localizacao"),fornecedor:get("fornecedor"),documento_entrada:get("documento_entrada"),recebido_em:get("recebido_em"),status:get("status")});
    return "/almoxarifado?view=entrada&ok=" + encodeURIComponent("Entrada registrada no histórico.");
  }
  if (action === "requisitar") {
    await criarRequisicao(env,user,{item_id:get("item_id"),quantidade:get("quantidade"),observacao:get("observacao"),setor:get("setor")});
    return "/almoxarifado?view=requisicoes&ok=" + encodeURIComponent("Requisição enviada ao Almoxarifado.");
  }
  if (action === "atender") {
    await atenderRequisicao(env,user,{requisicao_item_id:get("requisicao_item_id"),lote_id:get("lote_id"),quantidade:get("quantidade")});
    return "/almoxarifado?view=requisicoes&ok=" + encodeURIComponent("Saída registrada e vinculada à requisição.");
  }
  if (action === "ajustar_inventario") {
    await ajustarInventario(env,user,{lote_id:get("lote_id"),quantidade_contada:get("quantidade_contada"),motivo:get("motivo"),referencia:"CONTAGEM FÍSICA"});
    return "/almoxarifado?view=inventario&ok=" + encodeURIComponent("Contagem conferida. Diferença registrada, se existente.");
  }
  if (action === "movimento_especial") {
    await registrarMovimentoEspecial(env,user,{lote_id:get("lote_id"),tipo:get("tipo"),quantidade:get("quantidade"),local_destino:get("local_destino"),motivo:get("motivo")});
    return "/almoxarifado?view=movimentos&ok=" + encodeURIComponent("Movimento registrado.");
  }
  if (action === "status_lote") {
    await alterarStatusLote(env,{lote_id:get("lote_id"),status:get("status")});
    return "/almoxarifado?view=lotes&ok=" + encodeURIComponent("Situação do lote atualizada.");
  }
  throw new Error("Ação não reconhecida.");
}

async function handleApi(request, env, url, user) {
  const path = url.pathname;
  const gerente = await podeGerenciarAlmox(env,user);
  if (request.method === "GET" && path === "/almoxarifado/api/painel") return respostaJson(await dadosPainel(env));
  if (request.method === "GET" && path === "/almoxarifado/api/itens") return respostaJson(await dadosItens(env,url.searchParams.get("q")));
  if (request.method === "GET" && path === "/almoxarifado/api/lotes") return respostaJson(await dadosLotes(env,url.searchParams.get("item_id")));
  if (request.method === "GET" && path === "/almoxarifado/api/requisicoes") return respostaJson(await dadosRequisicoes(env));
  if (request.method === "GET" && path === "/almoxarifado/api/movimentos") return respostaJson(await dadosMovimentos(env));
  if (request.method === "POST" && path === "/almoxarifado/api/itens") {
    if (!gerente) return respostaJson({erro:"Acesso restrito aos responsáveis do Almoxarifado."},403);
    await criarItem(env,user,await lerJson(request)); return respostaJson({ok:true},201);
  }
  if (request.method === "POST" && path === "/almoxarifado/api/entrada") {
    if (!gerente) return respostaJson({erro:"Acesso restrito aos responsáveis do Almoxarifado."},403);
    await receberMaterial(env,user,await lerJson(request)); return respostaJson({ok:true},201);
  }
  if (request.method === "POST" && path === "/almoxarifado/api/requisicoes") {
    await criarRequisicao(env,user,await lerJson(request)); return respostaJson({ok:true},201);
  }
  if (request.method === "POST" && path === "/almoxarifado/api/atender") {
    if (!gerente) return respostaJson({erro:"Acesso restrito aos responsáveis do Almoxarifado."},403);
    await atenderRequisicao(env,user,await lerJson(request)); return respostaJson({ok:true},201);
  }
  if (request.method === "POST" && path === "/almoxarifado/api/inventario/ajuste") {
    if (!gerente) return respostaJson({erro:"Acesso restrito aos responsáveis do Almoxarifado."},403);
    await ajustarInventario(env,user,await lerJson(request)); return respostaJson({ok:true},201);
  }
  if (request.method === "POST" && path === "/almoxarifado/api/movimentos") {
    if (!gerente) return respostaJson({erro:"Acesso restrito aos responsáveis do Almoxarifado."},403);
    await registrarMovimentoEspecial(env,user,await lerJson(request)); return respostaJson({ok:true},201);
  }
  return respostaJson({erro:"Rota do Almoxarifado não encontrada."},404);
}

async function listarEquipeAlmoxarifado(env) {
  return todos(env.db, `
    SELECT u.id,u.nome,u.usuario,u.ativo,u.excluido,
      ae.funcao AS funcao_almox,ae.ativo AS almox_ativo
    FROM usuarios u
    LEFT JOIN almoxarifado_equipe ae ON ae.usuario_id=u.id
    WHERE u.perfil='FUNCIONARIO' AND u.excluido=0
    ORDER BY u.ativo DESC,u.nome COLLATE NOCASE
  `);
}

function renderPainelEquipeAlmoxarifado(usuarios) {
  const ativos = usuarios.filter((u) => Number(u.ativo) === 1 && Number(u.almox_ativo) === 1);
  const disponiveis = usuarios.filter((u) => Number(u.ativo) === 1 && Number(u.almox_ativo || 0) !== 1);
  const linhas = ativos.length ? ativos.map((u) =>
    '<tr><td><strong>' + escaparHtmlAlmox(u.nome) + '</strong><div class="mini">' + escaparHtmlAlmox(u.usuario) +
    '</div></td><td><span class="badge ok">Almoxarife</span></td><td><form method="POST" action="/almoxarifado/equipe/remover" class="acao-inline">' +
    '<input type="hidden" name="usuario_id" value="' + Number(u.id) + '">' +
    '<button class="botao-perigo" type="submit">Remover função</button>' +
    '</form></td></tr>'
  ).join("") : '<tr><td colspan="3">Nenhum almoxarife designado.</td></tr>';
  const opcoes = disponiveis.map((u) =>
    '<option value="' + Number(u.id) + '">' + escaparHtmlAlmox(u.nome + " · " + u.usuario) + '</option>'
  ).join("");
  return '<section id="painel-equipe-almox" class="card" style="margin:18px 0;padding:18px;border:1px solid #2872c8;border-radius:14px">' +
    '<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">' +
    '<div><h3 style="margin:0 0 5px">Equipe do Almoxarifado</h3>' +
    '<p class="nota" style="margin:0">Cadastre um funcionário exclusivo do estoque ou atribua a função a alguém já cadastrado. A função não concede acesso à produção.</p></div>' +
    '<span class="badge neutro">' + ativos.length + ' responsável(is)</span></div>' +
    '<div class="form-grid" style="margin-top:16px">' +
    '<div style="min-width:0"><h4>Cadastrar novo almoxarife</h4>' +
    '<form method="POST" action="/almoxarifado/equipe/criar"><div class="form-grid">' +
    '<label>Nome<input name="nome" required minlength="2" maxlength="100"></label>' +
    '<label>Usuário<input name="usuario" required minlength="3" maxlength="40" autocomplete="username"></label>' +
    '<label>Senha inicial<input type="password" name="senha" required minlength="6" autocomplete="new-password"></label>' +
    '<div class="full"><button type="submit">Cadastrar almoxarife</button></div></div></form></div>' +
    '<div style="min-width:0"><h4>Designar funcionário existente</h4>' +
    (opcoes ? '<form method="POST" action="/almoxarifado/equipe/atribuir"><div class="form-grid">' +
      '<label>Funcionário<select name="usuario_id" required><option value="">Selecione</option>' + opcoes + '</select></label>' +
      '<div class="full"><button type="submit">Atribuir função de Almoxarife</button></div></div></form>' :
      '<p class="nota">Todos os funcionários ativos já possuem a função ou não há funcionários disponíveis.</p>') +
    '</div></div>' +
    '<h4 style="margin:20px 0 8px">Responsáveis atuais</h4>' +
    '<div class="tabela-wrap"><table><thead><tr><th>Funcionário</th><th>Função</th><th>Ação</th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
    '</section>';
}

async function processarEquipeAlmoxarifado(request, env, user, path) {
  if (!gerenteAlmox(user)) throw new Error("Somente Administrador ou Coordenador pode administrar a equipe do Almoxarifado.");
  if (request.method !== "POST") throw new Error("Método não permitido.");
  const form = await request.formData();
  const get = (key) => String(form.get(key) ?? "").trim();
  if (path === "/almoxarifado/equipe/criar") {
    const nome = get("nome").slice(0,100);
    const login = get("usuario").toLowerCase().slice(0,40);
    const senha = String(form.get("senha") || "");
    if (nome.length < 2 || login.length < 3 || !/^[a-z0-9._-]+$/.test(login) || senha.length < 6) {
      throw new Error("Informe nome, usuário válido e senha com pelo menos seis caracteres.");
    }
    const duplicado = await primeiro(env.db,"SELECT id FROM usuarios WHERE lower(usuario)=? LIMIT 1",login);
    if (duplicado) throw new Error("Esse nome de usuário já está cadastrado.");
    const hash = await criarHashSenha(senha);
    const r = await executar(env.db, `
      INSERT INTO usuarios
        (nome,usuario,senha_hash,setor,area_producao,setor_convencional,perfil,ativo,excluido)
      VALUES (?,?,?,'ALMOXARIFADO','ALMOXARIFADO',NULL,'FUNCIONARIO',1,0)
    `,nome,login,hash);
    const id = Number(r?.meta?.last_row_id || 0);
    if (!id) throw new Error("A conta foi criada sem retornar o identificador. Verifique a Equipe antes de repetir.");
    try {
      await executar(env.db, `
        INSERT INTO almoxarifado_equipe (usuario_id,funcao,ativo,atribuido_por)
        VALUES (?,'ALMOXARIFE',1,?)
      `,id,Number(user.id));
    } catch (error) {
      await executar(env.db,"UPDATE usuarios SET ativo=0,excluido=1 WHERE id=?",id);
      throw new Error("Não foi possível atribuir a função de Almoxarife. A conta recém-criada foi desativada para evitar acesso incompleto. " + String(error?.message || ""));
    }
    return "/funcionarios?ok=" + encodeURIComponent("Almoxarife cadastrado. A conta não recebeu acesso aos setores de produção.");
  }
  if (path === "/almoxarifado/equipe/atribuir") {
    const id = Number(get("usuario_id"));
    const funcionario = await primeiro(env.db,
      "SELECT id FROM usuarios WHERE id=? AND perfil='FUNCIONARIO' AND ativo=1 AND excluido=0",id);
    if (!funcionario) throw new Error("Selecione um funcionário ativo.");
    await executar(env.db, `
      INSERT INTO almoxarifado_equipe (usuario_id,funcao,ativo,atribuido_por)
      VALUES (?,'ALMOXARIFE',1,?)
      ON CONFLICT(usuario_id) DO UPDATE SET
        funcao='ALMOXARIFE',ativo=1,atribuido_por=excluded.atribuido_por,
        atualizado_em=CURRENT_TIMESTAMP
    `,id,Number(user.id));
    return "/funcionarios?ok=" + encodeURIComponent("Função de Almoxarife atribuída ao funcionário.");
  }
  if (path === "/almoxarifado/equipe/remover") {
    const id = Number(get("usuario_id"));
    const result = await executar(env.db,
      "UPDATE almoxarifado_equipe SET ativo=0,atualizado_em=CURRENT_TIMESTAMP WHERE usuario_id=? AND ativo=1",id);
    if (Number(result?.meta?.changes || 0) < 1) throw new Error("Funcionário não possui uma função ativa de Almoxarife.");
    return "/funcionarios?ok=" + encodeURIComponent("Função de Almoxarife removida. A conta e o histórico do funcionário foram preservados.");
  }
  throw new Error("Ação da equipe do Almoxarifado não reconhecida.");
}

export async function injetarGestaoEquipeAlmoxarifado(response, request, env) {
  const url = new URL(request.url);
  if (!response || response.status !== 200 || request.method !== "GET" || url.pathname !== "/funcionarios") return response;
  const user = await obterUsuarioLogado(request,env);
  if (!gerenteAlmox(user)) return response;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  const original = await response.text();
  if (original.includes('id="painel-equipe-almox"')) return new Response(original,{status:response.status,statusText:response.statusText,headers:response.headers});
  const painel = renderPainelEquipeAlmoxarifado(await listarEquipeAlmoxarifado(env));
  const mainEnd = original.lastIndexOf("</main>");
  const bodyEnd = original.lastIndexOf("</body>");
  const pos = mainEnd >= 0 ? mainEnd : bodyEnd;
  if (pos < 0) return new Response(original,{status:response.status,statusText:response.statusText,headers:response.headers});
  const updated = original.slice(0,pos) + painel + original.slice(pos);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  return new Response(updated,{status:response.status,statusText:response.statusText,headers});
}

export async function handleAlmoxarifado(request, env, url) {
  const user = await obterUsuarioLogado(request,env);
  const isApi = url.pathname.startsWith("/almoxarifado/api/");
  if (!user) return isApi ? respostaJson({erro:"Sessão expirada."},401) : new Response(null,{status:302,headers:{Location:"/"}});
  try {
    if (request.method === "POST") {
      const origin = request.headers.get("origin");
      const crossSite = request.headers.get("sec-fetch-site") === "cross-site";
      if ((origin && origin !== new URL(request.url).origin) || crossSite) {
        return isApi ? respostaJson({erro:"Origem da solicitação não autorizada."},403) :
          redirecionar("/almoxarifado?erro=" + encodeURIComponent("Origem da solicitação não autorizada."));
      }
    }
    if (url.pathname.startsWith("/almoxarifado/equipe/")) {
      return redirecionar(await processarEquipeAlmoxarifado(request,env,user,url.pathname));
    }
    if (isApi) {
      if (request.method !== "GET" && request.method !== "POST") return respostaJson({erro:"Método não permitido."},405);
      return await handleApi(request,env,url,user);
    }
    if (request.method === "POST" && url.pathname === "/almoxarifado/acao") {
      return redirecionar(await processarFormulario(request,env,user));
    }
    if (request.method === "GET" && ["/almoxarifado","/almoxarifado/"].includes(url.pathname)) return await renderView(env,user,url);
    return respostaHtml(layoutAlmox(user,"dashboard",'<section class="panel"><p>Endereço não encontrado.</p></section>',await podeGerenciarAlmox(env,user)),404);
  } catch (error) {
    const message = String(error?.message || "Falha ao processar a operação.").slice(0,300);
    if (isApi) return respostaJson({erro:message},400);
    const view = String(url.searchParams.get("view") || "dashboard");
    return redirecionar("/almoxarifado?view=" + encodeURIComponent(view) + "&erro=" + encodeURIComponent(message));
  }
}

export async function injetarLinkAlmoxarifado(response, request) {
  if (!response || response.status !== 200 || request.method === "HEAD") return response;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  const original = await response.text();
  if (!original.includes('class="sidebar-nav"') || original.includes('href="/almoxarifado"')) {
    return new Response(original,{status:response.status,statusText:response.statusText,headers:response.headers});
  }
  const link = '<a href="/almoxarifado"><span class="nav-icone">▤</span><span>Almoxarifado</span></a>';
  const updated = original.replace(/(<nav\b[^>]*class="sidebar-nav"[^>]*>[\s\S]*?)(<\/nav>)/i,"$1" + link + "$2");
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  return new Response(updated,{status:response.status,statusText:response.statusText,headers});
}
