// FLUXO LAB V5.3.0 — CORE D1
// Execução de lotes D1 em blocos limitados, preservando ordem e tamanho configurado.
// Implementação original preservada.

export async function executarBatchV27ServiceV53(env, statements, tamanho = 60) {
  for (let i = 0; i < statements.length; i += tamanho) {
    const bloco = statements.slice(i, i + tamanho);
    if (bloco.length) await env.db.batch(bloco);
  }
}
