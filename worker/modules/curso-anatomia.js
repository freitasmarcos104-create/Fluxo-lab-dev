import { CURSO_ANATOMIA } from "./curso-anatomia-conteudo.js";

export const TITULO_CURSO_ANATOMIA = CURSO_ANATOMIA.titulo;

export function renderCheckpointAnatomia(escapeHtml) {
  const perguntas = CURSO_ANATOMIA.checkpoint.map((questao, indice) => `
    <fieldset style="margin:12px 0"><legend>${indice + 1}. ${escapeHtml(questao.pergunta)}</legend>
      ${questao.alternativas.map((alternativa) => `<label style="display:block"><input type="radio" name="anatomia_checkpoint_${indice}"> ${escapeHtml(alternativa)}</label>`).join("")}
      <details><summary>Conferir resposta</summary><p><strong>${escapeHtml(questao.alternativas[questao.correta])}</strong> ${escapeHtml(questao.explicacao)}</p></details>
    </fieldset>`).join("");
  return `<section class="card" style="margin-bottom:10px"><h3>Questionário intermediário</h3><p class="nota">Escolha uma alternativa por questão e confira a explicação. Você pode continuar a qualquer momento.</p>${perguntas}</section>`;
}

export async function cadastrarCursoAnatomia(db, usuarioId, agora) {
  const curso = CURSO_ANATOMIA;
  const buscarCurso = "SELECT id FROM universidade_cursos_v321 WHERE titulo=? COLLATE NOCASE ORDER BY id LIMIT 1";
  const existente = db.prepare(buscarCurso).bind(curso.titulo);
  if (await existente.first()) return false;

  const carga = curso.aulas.reduce((total, aula) => total + aula.minutos, 5 + 15);
  const aulas = JSON.stringify(curso.aulas);
  const questoes = JSON.stringify(curso.final);
  const competencias = JSON.stringify(curso.competencias);
  try {
    // O ID existente provoca conflito de chave se dois cadastros chegarem juntos.
    // O lote inteiro é revertido pelo D1 em caso de erro.
    await db.batch([
      db.prepare(`INSERT INTO universidade_cursos_v321
        (id,titulo,descricao,categoria,nivel,carga_horaria_minutos,nota_aprovacao,ativo,criado_por,criado_em,atualizado_em)
        VALUES ((${buscarCurso}),?,?,?,?,?,?,1,?,?,?)`)
        .bind(curso.titulo, curso.titulo, curso.descricao, curso.categoria, curso.nivel, carga, curso.nota, usuarioId, agora, agora),
      db.prepare(`INSERT INTO universidade_aulas_v321
        (curso_id,titulo,resumo,conteudo,video_url,material_url,ordem,duracao_minutos,ativo,criado_em)
        SELECT (${buscarCurso}),a.value->>'titulo',a.value->>'resumo',a.value->>'conteudo','','',a.key+1,a.value->>'minutos',1,?
        FROM json_each(?) a`).bind(curso.titulo, agora, aulas),
      db.prepare(`INSERT INTO universidade_questoes_v321 (curso_id,pergunta,ordem,ativo,criado_em)
        SELECT (${buscarCurso}),q.value->>'pergunta',q.key+1,1,? FROM json_each(?) q`)
        .bind(curso.titulo, agora, questoes),
      db.prepare(`INSERT INTO universidade_alternativas_v321 (questao_id,texto,ordem,correta)
        SELECT q.id,a.value,a.key+1,a.key=(dados.value->>'correta')
        FROM json_each(?) dados
        JOIN universidade_questoes_v321 q ON q.curso_id=(${buscarCurso}) AND q.ordem=dados.key+1
        JOIN json_each(dados.value->'alternativas') a`).bind(questoes, curso.titulo),
      db.prepare(`INSERT OR IGNORE INTO universidade_competencias_v321 (nome,ativo,criado_em)
        SELECT value,1,? FROM json_each(?)`).bind(agora, competencias),
      db.prepare(`INSERT OR IGNORE INTO universidade_curso_competencias_v321 (curso_id,competencia_id)
        SELECT (${buscarCurso}),cp.id FROM universidade_competencias_v321 cp
        JOIN json_each(?) nomes ON cp.nome=nomes.value COLLATE NOCASE`).bind(curso.titulo, competencias),
    ]);
  } catch (erro) {
    if (await existente.first()) return false;
    throw erro;
  }
  return true;
}
