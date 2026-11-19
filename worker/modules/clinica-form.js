const etapas = ["CAD/CAM", "Fatiamento", "Impressão", "Acabamento"];
export const estilos = `<style>
.cl-form{max-width:760px}.cl-form fieldset{margin:1rem 0;border:1px solid #61808a;border-radius:12px;padding:14px}.cl-form legend{font-weight:700;padding:0 6px}
.cl-par{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,275px),1fr));gap:12px}.cl-par fieldset{min-width:0;margin:.6rem 0}
.cl-arcada{width:100%;max-width:360px;aspect-ratio:1.3;position:relative;margin:1rem auto .2rem;background:radial-gradient(ellipse at center,transparent 44%,#80aaa518 46%,transparent 68%)}
.cl-arcada::after{content:attr(data-nome);position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:.8rem;letter-spacing:.08em;font-weight:700;opacity:.72;pointer-events:none}
.cl-dente{position:absolute;display:grid!important;place-items:stretch;transform:translate(-50%,-50%);margin:0!important;width:12%;height:14%}
.cl-dente input{position:absolute;opacity:0;width:1px;height:1px}
.cl-dente span{display:grid;place-items:center;box-sizing:border-box;background:linear-gradient(145deg,#fffdf4,#d7ded7);border:1px solid #93aaa5;border-radius:var(--forma);color:#203b42;box-shadow:inset 0 -3px 2px #647d7c38,0 2px 4px #0002;font-size:clamp(10px,2vw,14px);font-weight:750;cursor:pointer}
.cl-dente input:checked+span{background:#006662;color:white;outline:2px solid #6adac2;outline-offset:-1px}.cl-dente input:focus-visible+span{outline:3px solid #eaac42}
.cl-item{margin:16px 0;padding:14px;border:1px solid #67858b;border-radius:14px}.cl-item header{display:flex;align-items:center;justify-content:space-between;position:static;background:transparent;padding:0}.cl-item h3{margin:0}
button.cl-iniciar{background:#1c61a8!important;color:#fff!important}button.cl-concluir{background:#137147!important;color:#fff!important}
.cl-lados,.cl-fluxo{display:flex;gap:.5rem;flex-wrap:wrap}.cl-lados{justify-content:space-between;max-width:490px;margin:10px auto;font-size:.8rem}
.cl-fluxo{list-style:none;padding:0}.cl-fluxo li{border:1px solid #789097;border-radius:8px;padding:6px 10px}.cl-fluxo [aria-current]{background:#006a68;color:white;font-weight:bold}
</style>`;

function arcada(superior) {
  const nome = superior ? "superior" : "inferior";
  const posicoes = [[43.5,8],[31,13],[20,23],[13,36],[10,50],[8,64],[7,78],[7,92]];
  const dentes = (superior ? [1,2] : [4,3]).flatMap((q,lado) => posicoes.map(([x,y],i) => {
    const fdi = q*10+i+1;
    const forma = i < 2 ? "32% 32% 48% 48%" : i === 2 ? "43% 45% 55% 55%" : "38% 46% 40% 48%";
    return `<label class="cl-dente" style="left:${lado ? 100-x : x}%;top:${superior ? y : 100-y}%;--forma:${forma}"><input type="checkbox" name="fdi" value="${fdi}" aria-label="Dente ${fdi}"><span>${fdi}</span></label>`;
  })).join("");
  return `<fieldset><legend>Arcada ${nome}</legend><label><input style="width:auto" type="checkbox" name="arcada" value="${nome}"> Arcada ${nome} completa</label><div class="cl-lados"><span>Direita</span><span>Esquerda</span></div><div class="cl-arcada" data-nome="${nome.toUpperCase()}">${dentes}</div></fieldset>`;
}

export function ficha(pacientes, selecionado, tipos, escapar) {
  const options = pacientes.map(p => `<option value="${p.id}" ${p.id === selecionado ? "selected" : ""}>${escapar(p.nome)} · #${p.id}</option>`).join("");
  return `<section class="card cl-form"><h1>Trabalhos da Clínica</h1>
    <details ${pacientes.length ? "" : "open"}><summary>Cadastrar paciente</summary>
    <form method="post"><input type="hidden" name="acao" value="paciente"><input type="hidden" name="chave" value="${crypto.randomUUID()}">
    <label>Nome do paciente<input name="nome" maxlength="100" required></label><button>Cadastrar paciente</button></form></details>
    ${pacientes.length ? `<details ${selecionado ? "open" : ""}><summary>Novo trabalho</summary><form method="post">
    <input type="hidden" name="acao" value="criar"><input type="hidden" name="chave" value="${crypto.randomUUID()}">
    <label>Paciente<select name="paciente" required><option value="">Selecione o paciente</option>${options}</select></label>
    <p>Para cada trabalho, escolha o tipo e marque os dentes FDI ou a arcada completa.</p>
    <div data-itens><section class="cl-item"><header><h3>Trabalho 1</h3><button type="button" data-remover hidden>Remover</button></header>
    <input type="hidden" name="item" value="0"><label>Tipo de trabalho<select name="tipo" required><option value="">Selecione o trabalho</option>${tipos.map(t=>`<option value="${t}">${t.startsWith("Prótese total") ? "PT · " : ""}${t}</option>`).join("")}</select></label>
    <div class="cl-par">${arcada(true)}${arcada(false)}</div></section></div>
    <button type="button" class="botao-sec" data-adicionar>+ Adicionar outro trabalho</button>
    <label>Prazo de entrega (opcional)<input type="date" name="prazo"></label><label>Observações (opcional)<textarea name="observacoes" maxlength="1000"></textarea></label>
    <button>Salvar trabalhos</button></form></details><script>
    (() => {
      const form = document.querySelector('.cl-form select[name="tipo"]').form;
      const lista = form.querySelector('[data-itens]');
      const modelo = lista.firstElementChild.cloneNode(true);
      let proximo = 1;
      form.querySelector('[data-adicionar]').onclick = () => {
        const bloco = modelo.cloneNode(true);
        const id = proximo++;
        bloco.querySelector('[name=item]').value = id;
        for (const campo of bloco.querySelectorAll('[name=tipo],[name=fdi],[name=arcada]')) campo.name += '_' + id;
        bloco.querySelector('h3').textContent = 'Trabalho ' + (id + 1);
        bloco.querySelector('[data-remover]').hidden = false;
        lista.append(bloco);
        bloco.querySelector('select').focus();
      };
      lista.addEventListener('click', e => {
        if (e.target.matches('[data-remover]')) e.target.closest('.cl-item').remove();
      });
      lista.addEventListener('change', e => {
        const grupo = e.target.closest('fieldset');
        if (!grupo) return;
        const completa = grupo.querySelector('[name^=arcada]');
        const dentes = Array.from(grupo.querySelectorAll('[name^=fdi]'));
        if (e.target === completa) for (const d of dentes) d.checked = completa.checked;
        completa.checked = dentes.every(d => d.checked);
        completa.indeterminate = !completa.checked && dentes.some(d => d.checked);
        grupo.closest('.cl-item').querySelector('[name^=fdi]').setCustomValidity('');
      });
      form.addEventListener('submit', e => {
        for (const bloco of lista.children) {
          if (bloco.querySelector('[name^=fdi]:checked, [name^=arcada]:checked')) continue;
          e.preventDefault();
          const primeiro = bloco.querySelector('[name^=fdi]');
          primeiro.setCustomValidity('Selecione os dentes ou uma arcada deste trabalho.');
          primeiro.reportValidity();
          break;
        }
      });
    })();
    </script>` : ""}</section>`;
}

export function progresso(item) {
  const n = item.andamento, atual = Math.floor(n/2);
  const acao = n === 8 ? "Reabrir acabamento" : (n%2 ? "Concluir " : "Iniciar ") + etapas[atual];
  const passos = etapas.map((etapa,i) => `<li ${i===atual ? 'aria-current="step"' : ""}>${i<atual ? "✓ " : ""}${etapa}</li>`).join("");
  return `<ol class="cl-fluxo" aria-label="Etapas do trabalho">${passos}</ol><p>${n===8 ? "Trabalho concluído" : (n%2 ? "Em execução" : "Aguardando início") + " · " + etapas[atual]}</p>
    <form method="post"><input type="hidden" name="acao" value="etapa"><input type="hidden" name="id" value="${item.id}">
    <input type="hidden" name="atual" value="${n}"><button class="botao-bloco ${n%2 ? "botao-verde cl-concluir" : "cl-iniciar"}">${acao}</button></form>`;
}
