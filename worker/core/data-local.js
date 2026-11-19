const calendario = new Intl.DateTimeFormat("pt-BR", {timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric"});

export function dataCurtaLaboratorio(valor) {
  if (!valor) return "—";
  const texto = String(valor).trim();
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (dia) return `${dia[3]}/${dia[2]}/${dia[1]}`;
  const iso = texto.replace(" ", "T");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(iso)) return texto;
  const instante = new Date(/(?:Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : iso + "Z");
  return Number.isNaN(instante.getTime()) ? texto : calendario.format(instante);
}
