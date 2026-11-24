import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { construirMensagemImpedimentoV516 } from "../worker/modules/impedimentos-remessa.js";
import { temAvisoPacienteFilaV517, contarAvisosFilaV517, renderAvisoPacienteFilaV517, renderResumoAvisosFilaV517 } from "../worker/modules/avisos-fila-funcionario.js";

const mensagem = (remessaId, texto="SCANNER com malha danificada") =>
  construirMensagemImpedimentoV516(remessaId,"NAO_PRODUZIR","MALHA_INVALIDA",texto);
const paciente = (id, remessaId=4, aviso_remessa=null) =>
  ({trabalho_id:id,remessa_id:remessaId,paciente:"Paciente "+id,aviso_remessa});

test("aviso cadastrado na remessa aparece no card do funcionario sem novo registro",()=>{
  const p=paciente(7,4,mensagem(4));
  assert.equal(temAvisoPacienteFilaV517(p),true);
  const html=renderAvisoPacienteFilaV517(p);
  assert.match(html,/Não produzir nesta remessa/);
  assert.match(html,/Problema na malha 3D/);
  assert.match(html,/SCANNER com malha danificada/);
  assert.match(html,/f59e0b/);
});

test("impedimento de outra remessa e aviso resolvido nao aparecem",()=>{
  const antiga=paciente(7,9,mensagem(4));
  assert.equal(temAvisoPacienteFilaV517(antiga),false);
  assert.equal(renderAvisoPacienteFilaV517(antiga),"");
  assert.equal(temAvisoPacienteFilaV517(paciente(8,4,null)),false);
  assert.equal(temAvisoPacienteFilaV517(paciente(8,4,"Pendência comum")),false);
});

test("texto exibido ao funcionario e escapado, assim como na aba Digital",()=>{
  const p=paciente(7,4,mensagem(4,'<img src=x onerror=alert(1)>'));
  const html=renderAvisoPacienteFilaV517(p);
  assert.doesNotMatch(html,/<img src=/);
  assert.match(html,/&lt;img/);
});

test("contador por paciente e resumo laranja somente para avisos ativos",()=>{
  const lista=[paciente(1,4,mensagem(4)),paciente(2,4,null),paciente(3,4,mensagem(4)),paciente(4,4,"nota normal")];
  assert.equal(contarAvisosFilaV517(lista),2);
  assert.match(renderResumoAvisosFilaV517(lista),/⚠ 2 com impedimento/);
  assert.equal(renderResumoAvisosFilaV517([]),"");
  assert.equal(contarAvisosFilaV517(null),0);
});

test("integracao no inicio e na fila completa preserva o mesmo CTE e vinculo",()=>{
  const src=readFileSync(new URL("../worker/legacy.js",import.meta.url),"utf8");
  const idx=src.indexOf("async function meusDesignadosV338(");
  const fim=src.indexOf("function nomeArcadaFilaV347(",idx);
  assert.ok(idx>=0&&fim>idx);
  const sql=src.slice(idx,fim);
  assert.match(sql,/sqlAvisoRemessaV516\("t"\)\} AS aviso_remessa/);
  assert.match(sql,/COUNT\(DISTINCT CASE WHEN vinculo='MEU' AND aviso_remessa IS NOT NULL THEN trabalho_id END\) AS pacientes_meus_impedidos/);
  assert.match(sql,/e\.responsavel_id IS NULL OR e\.responsavel_id=\?/);
  assert.match(sql,/c\.responsavel_id IS NULL OR c\.responsavel_id=\?/);
  const rest=src.slice(fim,src.indexOf("function iniciarTemaV339(",fim));
  assert.match(rest,/aviso_remessa: r\.aviso_remessa/);
  assert.match(rest,/remessa_id: r\.remessa_id/);
  const inicio=rest.slice(rest.indexOf("function tabelaFilaResumoV3414("),rest.indexOf("function cardPacienteFilaV3414("));
  const completa=rest.slice(rest.indexOf("function cardPacienteFilaV3414("),rest.indexOf("function painelMeusV338("));
  assert.match(inicio,/renderAvisoPacienteFilaV517\(p\)/);
  assert.match(completa,/renderAvisoPacienteFilaV517\(p\)/);
  assert.match(rest,/painelMeusV338\(d\)/);
  assert.match(rest,/secaoFilaCompletaV3414\(u, designados/);
});
