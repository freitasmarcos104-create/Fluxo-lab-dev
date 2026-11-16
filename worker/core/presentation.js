// FLUXO LAB V5.5.0 — FORMATADORES DE INTERFACE
// Funções puras extraídas do legacy.js sem alteração de lógica ou retorno.

/* =========================================================
   NOMES E DATAS
========================================================= */

export function formatarData(valor) {
  if (!valor) {
    return "—";
  }

  try {
    return new Date(valor)
      .toLocaleString(
        "pt-BR",
        {
          timeZone:
            "America/Sao_Paulo",

          day:
            "2-digit",

          month:
            "2-digit",

          year:
            "numeric",

          hour:
            "2-digit",

          minute:
            "2-digit"
        }
      );

  } catch {
    return String(valor);
  }
}

export function formatarDataCurta(valor) {
  if (!valor) {
    return "—";
  }

  const partes =
    String(valor)
      .slice(0, 10)
      .split("-");

  if (
    partes.length !== 3
  ) {
    return String(valor);
  }

  return (
    `${partes[2]}/` +
    `${partes[1]}/` +
    `${partes[0]}`
  );
}

export function nomeTipo(tipo) {
  if (
    tipo === "PT"

    ||

    tipo === "TOTAL"
  ) {
    return "Prótese total";
  }

  if (
    tipo === "PPR"
  ) {
    return "PPR flex";
  }

  return "Sem trabalho";
}

export function nomeComponente(
  componente
) {
  const nomes = {
    BASE:
      "Base",

    DENTES:
      "Dentes",

    GENGIVA:
      "Gengiva",

    PPR_FLEX:
      "PPR flex"
  };

  return (
    nomes[componente]
    ||
    componente
    ||
    "—"
  );
}

export function nomeStatus(status) {
  const nomes = {
    AGUARDANDO:
      "Aguardando",

    EM_ANDAMENTO:
      "Em andamento",

    CONCLUIDO:
      "Concluído",

    ABERTO:
      "Aberto"
  };

  return (
    nomes[status]
    ||
    status
    ||
    "—"
  );
}

export function classeStatus(status) {
  if (
    status ===
    "CONCLUIDO"
  ) {
    return "ok";
  }

  if (
    status ===
    "EM_ANDAMENTO"
  ) {
    return "andamento";
  }

  if (
    status ===
    "ABERTO"
  ) {
    return "alerta";
  }

  return "neutro";
}

export function perfilNome(perfil) {
  const nomes = {
    ADMINISTRADOR:
      "Administrador",

    COORDENADOR:
      "Coordenador",

    GERENCIA:
      "Gerência",

    CADASTRO:
      "Cadastro",

    FUNCIONARIO:
      "Funcionário"
  };

  return (
    nomes[perfil]
    ||
    perfil
  );
}
