import { gerirTrabalho } from "../worker/modules/gestao-trabalho.js";
import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { trabalhosClinica, tiposClinica } from "../worker/modules/trabalhos-clinica.js";

test("Cada administrador vê e atualiza seus casos; repetir o envio não duplica o caso", async () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec("CREATE TABLE usuarios(id INTEGER PRIMARY KEY); INSERT INTO usuarios VALUES (1),(2)");
  sql.exec(readFileSync(new URL("../worker/migrations/0006_trabalhos_clinica.sql", import.meta.url), "utf8"));
  sql.exec(readFileSync(new URL("../worker/migrations/0007_clinica_pacientes.sql", import.meta.url),"utf8"));
  sql.exec(readFileSync(new URL("../worker/migrations/0008_clinica_entrega_historico.sql", import.meta.url),"utf8"));
  const db = {batch: statements => statements.map(s => s.run()), prepare(query) {
    const stmt = sql.prepare(query);
    return {bind(...args) { return {
      first: () => stmt.get(...args), all: () => ({results: stmt.all(...args)}), run: () => ({meta:stmt.run(...args)})
    }; }};
  }};
  const origin = "https://example.test";
  const render = {layout: s => s, htmlResponse: (s,status) => new Response(s,{status}), escapeHtml: s => s.replaceAll("<","&lt;")};
  const chamar = (id, dados) => trabalhosClinica(new Request(origin + "/trabalhos-clinica", dados && {
    method:"POST", headers:{Origin:origin}, body:new URLSearchParams(dados)
  }), db, {id, perfil:"ADMINISTRADOR"}, render);
  const paciente = {acao:"paciente",nome:"Caso <teste>",chave:crypto.randomUUID()};
  assert.equal((await chamar(1,paciente)).headers.get("Location"),"/trabalhos-clinica?paciente=1");
  const novo = {acao:"criar",chave:crypto.randomUUID(),paciente:"1",fdi:"11",arcada:"inferior",tipo:"Onlay",prazo:"2026-11-18"};
  assert.equal(tiposClinica.length,9);
  assert.equal((await chamar(1,{...novo,prazo:"2026-02-30"})).status,400);
  assert.equal((await chamar(1,novo)).status,303);
  assert.equal((await chamar(1,novo)).status,303);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM trabalhos_clinica").get().n,1);
  const resposta = await chamar(1);
  assert.equal(resposta.headers.get("Cache-Control"),"private, no-store");
  assert.match(await resposta.text(),/Caso &lt;teste>[\s\S]*18\/11\/2026/);
  assert.doesNotMatch(await (await chamar(2)).text(),/Caso &lt;teste>/);
  assert.equal((await chamar(2,novo)).status,404);
  assert.equal((await chamar(1,{...novo,fdi:"99"})).status,400);
  const dentes = sql.prepare("SELECT dentes FROM trabalhos_clinica").get().dentes.split(", ");
  assert.equal(dentes.length,17);
  assert.ok(dentes.includes("48"));
  const status = {acao:"etapa",id:"1",atual:"0"};
  assert.equal((await chamar(2,status)).status,409);
  for (let atual=0; atual<8; atual++) {
    assert.equal((await chamar(1,{...status,atual})).status,303);
    assert.equal((await chamar(1,{...status,atual})).status,409);
  }
  assert.match(await (await chamar(1)).text(),/Aguardando entrega/);
  assert.equal((await chamar(1,{...status,atual:8})).status,303);
  assert.match(await (await chamar(1)).text(),/Concluir Acabamento/);
  const lote = new URLSearchParams({...novo,chave:crypto.randomUUID(),fdi:"21",arcada:"superior",tipo:tiposClinica[0]});
  lote.append("item","0");
  lote.append("item","1");
  lote.set("tipo_1",tiposClinica[1]);
  lote.set("fdi_1","36");
  lote.append("item","2");
  lote.set("tipo_2","Faceta");
  lote.set("fdi_2","21");
  assert.equal((await chamar(1,lote)).status,303);
  assert.equal((await chamar(1,lote)).status,303);
  const loteSalvo = sql.prepare("SELECT tipo,dentes,andamento FROM trabalhos_clinica WHERE id>1 ORDER BY id").all();
  assert.equal(loteSalvo.length,3);
  assert.equal(loteSalvo[0].dentes.split(", ").length,16);
  assert.equal(loteSalvo[1].dentes,"36");
  assert.equal(loteSalvo[2].dentes,"21");
  lote.set("chave",crypto.randomUUID());
  lote.set("fdi_2","99");
  assert.equal((await chamar(1,lote)).status,400);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM trabalhos_clinica").get().n,4);
  assert.equal((await chamar(1,{acao:"entregar",id:"1"})).status,409);
  await chamar(1,{...status,atual:7});
  assert.equal((await chamar(2,{acao:"entregar",id:"1"})).status,409);
  assert.equal((await chamar(1,{acao:"entregar",id:"1"})).status,303);
  assert.equal((await chamar(1,{acao:"entregar",id:"1"})).status,409);
  assert.equal((await chamar(1,{...status,atual:8})).status,409);
  assert.equal((await chamar(2,{acao:"excluir",id:"1"})).status,409);
  assert.equal((await chamar(1,{acao:"excluir",id:"1"})).status,303);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM clinica_eventos WHERE trabalho_id=1 AND evento IN ('entregue','excluido')").get().n,2);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM trabalhos_clinica WHERE excluido_em IS NULL").get().n,3);
  sql.close();
});

test("A Clínica bloqueia leitura e escrita para os demais perfis antes de acessar o banco", async () => {
  const render = {layout: s => s, htmlResponse: (s,status) => new Response(s,{status})};
  for (const perfil of ["COORDENADOR","GERENCIA","CADASTRO","FUNCIONARIO",null]) {
    for (const method of ["GET","POST"]) {
      const request = new Request("https://example.test/trabalhos-clinica",{method});
      const resposta = await trabalhosClinica(request,null,{id:1,perfil},render);
      assert.equal(resposta.status,403);
    }
  }
});

test("Gestão de trabalhos exige administrador, separa áreas e preserva o histórico",async()=>{
  const sql=new DatabaseSync(":memory:");
  sql.exec(`CREATE TABLE trabalhos(id INTEGER PRIMARY KEY,paciente,excluido DEFAULT 0,arquivado,excluido_em,excluido_por,motivo_exclusao);
    CREATE TABLE trabalhos_convencionais(id INTEGER PRIMARY KEY,paciente,excluido DEFAULT 0);
    CREATE TABLE historico(trabalho_id,usuario_id,acao,detalhes,criado_em);
    CREATE TABLE auditoria_convencional(trabalho_id,acao,valor_anterior,valor_novo,motivo,realizado_por,criado_em);
    INSERT INTO trabalhos(id,paciente) VALUES(1,'Teste');
    INSERT INTO trabalhos_convencionais(id,paciente) VALUES(1,'Outro');`);
  const db={prepare(q){const st=sql.prepare(q);return {bind(...args){return {first:()=>st.get(...args),run:()=>({meta:st.run(...args)})};}};},
    batch(stmts){return stmts.map(st=>st.run());}};
  const origem="https://example.test";
  const chamar=(perfil,area,dados)=>gerirTrabalho(new Request(origem,{method:"POST",headers:{Origin:origem},body:new URLSearchParams(dados)}),db,{id:1,perfil},area,1,{redirect:()=>new Response(null,{status:303})});
  for (const area of ["digital","convencional"]) {
    const excluir={acao:"excluir",motivo:"Cadastro duplicado"};
    assert.equal((await chamar("COORDENADOR",area,excluir)).status,403);
    assert.equal((await chamar("ADMINISTRADOR",area,{acao:"editar",nome:"Corrigido"})).status,303);
    assert.equal((await chamar("ADMINISTRADOR",area,excluir)).status,303);
    assert.equal((await chamar("ADMINISTRADOR",area,excluir)).status,404);
  }
  for (const tabela of ["historico","auditoria_convencional"])
    assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM "+tabela).get().n,2);
  sql.close();
});
