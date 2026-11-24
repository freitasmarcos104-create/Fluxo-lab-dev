import test from "node:test";
import assert from "node:assert/strict";
import {
  construirMensagemImpedimentoV516,
  lerImpedimentoV516,
  renderAvisoRemessaV516,
  renderFormImpedimentoRemessaV516,
  resumoImpedimentosV516,
  sqlAvisoRemessaV516
} from "../worker/modules/impedimentos-remessa.js";
import { renderPainelProtesesRemessaV515 } from "../worker/modules/remessas-proteses.js";

const aviso = (id, st="NAO_PRODUZIR", motivo="SCAN_INVALIDO", observacao="Scan superior com falha na malha") =>
  construirMensagemImpedimentoV516(id,st,motivo,observacao);

test("registra e le impedimento com tipo, observacao e remessa",()=>{
  const item=lerImpedimentoV516(aviso(44),44);
  assert.equal(item.remessaId,44);
  assert.equal(item.situacao,"Não produzir nesta remessa");
  assert.equal(item.motivo,"Problema no scan");
  assert.match(item.observacao,/falha na malha/);
});
test("impedimento de outra remessa nunca aparece",()=>{
  assert.equal(lerImpedimentoV516(aviso(44),45),null);
  assert.equal(renderAvisoRemessaV516(aviso(44),45),"");
  assert.equal(lerImpedimentoV516("mensagem PENDENCIA comum",44),null);
});
test("validacao rejeita dados incompletos ou fora do catalogo",()=>{
  assert.throws(()=>aviso(0));
  assert.throws(()=>aviso(3,"NOPE"));
  assert.throws(()=>aviso(3,"AGUARDANDO","MOTIVO_INVALIDO"));
  assert.throws(()=>aviso(3,"AGUARDANDO","NAO_ENVIADO","x"));
  assert.throws(()=>aviso(3,"AGUARDANDO","NAO_ENVIADO","x".repeat(501)));
});
test("aviso HTML laranja escapa entrada e formulario permite resolucao",()=>{
  const mensagem=aviso(7,"AGUARDANDO","MALHA_INVALIDA","<img src=x onerror=alert(1)>");
  const html=renderAvisoRemessaV516(mensagem,7);
  assert.match(html,/f59e0b/);
  assert.match(html,/Aguardando correção/);
  assert.doesNotMatch(html,/<img src=/);
  assert.match(html,/&lt;img/);
  const form=renderFormImpedimentoRemessaV516(19,7,mensagem,true);
  assert.match(form,/impedimento-remessa/);
  assert.match(form,/name="acao" value="resolver"/);
  assert.match(form,/value="MALHA_INVALIDA" selected/);
  assert.equal(renderFormImpedimentoRemessaV516(19,7,mensagem,false),"");
});
test("contadores de remessa: 31 cadastrados, 5 impedidos, 26 sem aviso",()=>{
  const pessoas=Array.from({length:31},(_,i)=>({
    id:i+1,codigo:"FL"+i,paciente:"Paciente "+i,remessa_id:8,
    superior_tipo:i%2?"PT":"PPR",inferior_tipo:"NONE",
    aviso_remessa:i<5?aviso(8):null
  }));
  assert.deepEqual(resumoImpedimentosV516(pessoas),{total:31,impedidos:5,semImpedimento:26});
  const html=renderPainelProtesesRemessaV515(pessoas,8,{permitirEdicao:false});
  assert.match(html,/31 cadastrados/);
  assert.match(html,/5 com impedimento/);
  assert.match(html,/26 sem aviso ativo/);
  assert.match(html,/data-filtro-v515="impedidos"/);
  assert.match(html,/Não produzir nesta remessa/);
});
test("subconsulta restringe aviso ao paciente, a remessa e a pendencias abertas",()=>{
  const sql=sqlAvisoRemessaV516("t");
  assert.match(sql,/ca.trabalho_id=t.id/);
  assert.match(sql,/ca.resolvido=0/);
  assert.match(sql,/t.remessa_id/);
  assert.throws(()=>sqlAvisoRemessaV516("t; DROP TABLE trabalhos"));
});
