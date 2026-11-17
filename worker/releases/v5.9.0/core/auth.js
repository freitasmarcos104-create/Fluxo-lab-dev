// FLUXO LAB V4.1.0 — CORE AUTH
// Extração sem alteração dos algoritmos e formatos de hash da V4.0.0.
// O encoder é privado deste módulo. O restante da aplicação mantém seu próprio encoder para os pacotes ZIP.
const encoder = new TextEncoder();

export function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)]
    .map(b =>
      b
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}

export function hexToBytes(hex) {
  const bytes =
    new Uint8Array(
      hex.length / 2
    );

  for (
    let i = 0;
    i < bytes.length;
    i++
  ) {
    bytes[i] =
      parseInt(
        hex.substr(
          i * 2,
          2
        ),
        16
      );
  }

  return bytes;
}

export async function sha256(text) {
  return bytesToHex(
    await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(text)
    )
  );
}


/* =========================================================
   SENHAS
========================================================= */

export async function criarHashSenha(senha) {
  const salt =
    crypto.getRandomValues(
      new Uint8Array(16)
    );

  const iterations = 100000;

  const keyMaterial =
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(senha),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

  const bits =
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );

  return (
    `${iterations}$` +
    `${bytesToHex(salt)}$` +
    `${bytesToHex(bits)}`
  );
}

export async function verificarSenha(
  senha,
  hashSalvo
) {
  try {
    const [
      iterationsText,
      saltHex,
      hashHex
    ] =
      String(
        hashSalvo || ""
      ).split("$");

    const iterations =
      Number(
        iterationsText
      );

    if (
      !iterations ||
      !saltHex ||
      !hashHex
    ) {
      return false;
    }

    const keyMaterial =
      await crypto.subtle.importKey(
        "raw",
        encoder.encode(senha),
        "PBKDF2",
        false,
        ["deriveBits"]
      );

    const bits =
      await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",

          salt:
            hexToBytes(
              saltHex
            ),

          iterations,

          hash: "SHA-256"
        },
        keyMaterial,
        256
      );

    return (
      bytesToHex(bits)
      ===
      hashHex
    );

  } catch {
    return false;
  }
}


/* =========================================================
   SESSÃO
========================================================= */

export function gerarToken() {
  return bytesToHex(
    crypto.getRandomValues(
      new Uint8Array(32)
    )
  );
}

export function lerCookie(
  request,
  nome
) {
  const cookies =
    request.headers.get(
      "Cookie"
    ) || "";

  for (
    const item
    of cookies.split(";")
  ) {
    const [
      chave,
      ...resto
    ] =
      item
        .trim()
        .split("=");

    if (
      chave === nome
    ) {
      return resto.join("=");
    }
  }

  return null;
}

export async function obterUsuarioLogado(
  request,
  env
) {
  const token =
    lerCookie(
      request,
      "fluxo_session"
    );

  if (!token) {
    return null;
  }

  const tokenHash =
    await sha256(token);

  const agora =
    new Date()
      .toISOString();

  return await env.db.prepare(`

    SELECT
      u.id,
      u.nome,
      u.usuario,
      u.setor,
      u.area_producao,
      u.setor_convencional,
      u.perfil,
      u.ativo,
      u.excluido,

      COALESCE((
        SELECT GROUP_CONCAT(ua.area, '|')
        FROM usuario_areas ua
        WHERE ua.usuario_id = u.id AND ua.ativo = 1
      ), '') AS areas_v31,

      COALESCE((
        SELECT GROUP_CONCAT(us.area || ':' || us.setor, '|')
        FROM usuario_setores us
        WHERE us.usuario_id = u.id AND us.ativo = 1
      ), '') AS setores_v31,

      CASE

        WHEN u.perfil IN (
          'ADMINISTRADOR',
          'COORDENADOR'
        )

        THEN (

          SELECT
            COUNT(*)

          FROM avisos_coordenador a

          WHERE
            a.lido = 0
            AND a.encerrado = 0
        )

        ELSE 0

      END AS avisos_nao_lidos,

      CASE
        WHEN u.perfil = 'CADASTRO' THEN 0
        ELSE (
          SELECT COUNT(*)
          FROM mensagens_privadas mp
          WHERE mp.destinatario_id = u.id
            AND mp.lido = 0
        )
      END AS mensagens_nao_lidas

    FROM sessoes s

    INNER JOIN usuarios u
      ON u.id = s.usuario_id

    WHERE
      s.token_hash = ?

      AND s.expira_em > ?

      AND u.ativo = 1

      AND u.excluido = 0

    LIMIT 1

  `)
    .bind(
      tokenHash,
      agora
    )
    .first();
}
