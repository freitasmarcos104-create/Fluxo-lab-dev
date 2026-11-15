// FLUXO LAB V5.4.0 — SERVIÇO DE NOTIFICAÇÕES CENTRAIS
// Data local, resposta JSON sem cache, registro idempotente e distribuição em lote.
// SQL, limites de campos e comportamento de falha preservados.

export function dataLocalNotificacoesV324ServiceV54() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return `${p.find(x => x.type === "year")?.value}-${p.find(x => x.type === "month")?.value}-${p.find(x => x.type === "day")?.value}`;
}

export function respostaJsonNotificacoesV324ServiceV54(dados, status = 200) {
  return new Response(JSON.stringify(dados), { status, headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function registrarNotificacaoCentralV324ServiceV54(env, usuarioId, tipo, titulo, mensagem, link, chaveEvento, criadoEm = new Date().toISOString()) {
  const id = Number(usuarioId || 0);
  if (!Number.isInteger(id) || id <= 0 || !chaveEvento) return false;
  try {
    await env.db.prepare(`INSERT OR IGNORE INTO notificacoes_central_v324 (usuario_id,tipo,titulo,mensagem,link,chave_evento,criado_em) VALUES (?,?,?,?,?,?,?)`)
      .bind(id, String(tipo || "AVISO").slice(0, 30), String(titulo || "Notificação").slice(0, 140), String(mensagem || "").slice(0, 1000), String(link || "/").slice(0, 240), String(chaveEvento).slice(0, 220), criadoEm).run();
    return true;
  } catch (_) {
    // A atividade principal não deve ser desfeita por falha isolada da caixa de notificações.
    return false;
  }
}

export async function notificarUsuariosAtivosV324ServiceV54(env, dados, opcoes = {}) {
  const usuarios = (await env.db.prepare(`
    SELECT u.*,
      COALESCE((SELECT GROUP_CONCAT(ua.area,'|') FROM usuario_areas ua WHERE ua.usuario_id=u.id AND ua.ativo=1),'') AS areas_v31,
      COALESCE((SELECT GROUP_CONCAT(us.area || ':' || us.setor,'|') FROM usuario_setores us WHERE us.usuario_id=u.id AND us.ativo=1),'') AS setores_v31
    FROM usuarios u
    WHERE COALESCE(u.excluido,0)=0 AND COALESCE(u.ativo,0)=1
  `).all()).results || [];
  const excluido = Number(opcoes.excluirUsuarioId || 0);
  const filtro = typeof opcoes.filtro === "function" ? opcoes.filtro : () => true;
  const criadasEm = new Date().toISOString();
  const statements = [];
  for (const u of usuarios) {
    if (!u || Number(u.id) === excluido || !filtro(u)) continue;
    statements.push(env.db.prepare(`INSERT OR IGNORE INTO notificacoes_central_v324 (usuario_id,tipo,titulo,mensagem,link,chave_evento,criado_em) VALUES (?,?,?,?,?,?,?)`)
      .bind(Number(u.id), String(dados.tipo || "AVISO").slice(0, 30), String(dados.titulo || "Notificação").slice(0, 140), String(dados.mensagem || "").slice(0, 1000), String(dados.link || "/").slice(0, 240), String(dados.chaveEvento || "").slice(0, 220), criadasEm));
  }
  for (let i = 0; i < statements.length; i += 50) await env.db.batch(statements.slice(i, i + 50));
  return statements.length;
}
