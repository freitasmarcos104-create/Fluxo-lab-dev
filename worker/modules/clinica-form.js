const etapas = ["CAD/CAM", "Fatiamento", "Impressão", "Acabamento"];
export const estilos = `<style>
.cl-form{max-width:760px}.cl-form fieldset{margin:1rem 0;border:1px solid #61808a;border-radius:12px;padding:14px}.cl-form legend{font-weight:700;padding:0 6px}
.cl-arcada{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));grid-template-rows:repeat(5,auto);gap:3px;max-width:490px;margin:auto}
.cl-dente{display:block!important;position:relative;margin:0!important}.cl-dente input{position:absolute;width:1px;height:1px;opacity:0}
.cl-dente span{display:grid;place-items:center;min-height:36px;border:1px solid #749699;border-radius:45% 45% 36% 36%;font-weight:bold;cursor:pointer}
.cl-dente input:checked+span{background:#006a68;color:white;border:2px solid #69d8cd}.cl-dente input:focus-visible+span{outline:3px solid #c59325}
.cl-lados,.cl-fluxo{display:flex;gap:.5rem;flex-wrap:wrap}.cl-lados{justify-content:space-between;max-width:490px;margin:10px auto;font-size:.8rem}
.cl-fluxo{list-style:none;padding:0}.cl-fluxo li{border:1px solid #789097;border-radius:8px;padding:6px 10px}.cl-fluxo [aria-current]{background:#006a68;color:white;font-weight:bold}
</style>`;

function arcada(superior) {
  const nome = superior ? "superior" : "inferior";
  const posicoes = [[1,4],[1,3],[1,2],[2,2],[2,1],[3,1],[4,1],[5,1]];
  const dentes = (superior ? [1,2] : [4,3]).flatMap((q,lado) => posicoes.map(([linha,coluna],i) => {
    const fdi = q*10+i+1;
    return `<label class="cl-dente" style="grid-row:${superior ? linha : 6-linha};grid-column:${lado ? 9-coluna : coluna}"><input type="checkbox" name="fdi" value="${fdi}" aria-label="Dente ${fdi}"><span>${fdi}</span></label>`;
  })).join("");
  return `<fieldset><legend>Arcada ${nome}</legend><label><input style="width:auto" type="checkbox" name="arcada" value="${nome}"> Arcada ${nome} completa</label><div class="cl-arcada">${dentes}</div></fieldset>`;
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
    <label>Tipo de trabalho<select name="tipo" required><option value="">Selecione o trabalho</option>${tipos.map(t=>`<option>${t}</option>`).join("")}</select></label>
    <h3>Seleção FDI</h3><p>Marque os dentes do caso ou a arcada completa. Os lados são os do paciente.</p>
    <div class="cl-lados"><span>Direita do paciente</span><span>Esquerda do paciente</span></div>${arcada(true)}${arcada(false)}
    <label>Prazo de entrega (opcional)<input type="date" name="prazo"></label><label>Observações (opcional)<textarea name="observacoes" maxlength="1000"></textarea></label>
    <button>Salvar trabalho</button></form></details><script>
    (() => {
      const form = document.querySelector('.cl-form select[name="tipo"]').form;
      for (const grupo of form.querySelectorAll('input[name="arcada"]')) {
        const dentes = Array.from(grupo.closest('fieldset').querySelectorAll('input[name="fdi"]'));
        grupo.addEventListener('change', () => { for (const dente of dentes) dente.checked = grupo.checked; });
        for (const dente of dentes) dente.addEventListener('change', () => {
          grupo.checked = dentes.every(d => d.checked);
          grupo.indeterminate = !grupo.checked && dentes.some(d => d.checked);
        });
      }
      const primeiro = form.querySelector('[name="fdi"]');
      form.addEventListener('change', () => primeiro.setCustomValidity(''));
      form.addEventListener('submit', event => {
        if (!form.querySelector('[name="fdi"]:checked, [name="arcada"]:checked')) {
          event.preventDefault();
          primeiro.setCustomValidity('Selecione um dente ou uma arcada.');
          primeiro.reportValidity();
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
    <input type="hidden" name="atual" value="${n}"><button>${acao}</button></form>`;
}
