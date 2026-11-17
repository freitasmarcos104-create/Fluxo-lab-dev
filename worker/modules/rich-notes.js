export const RICH_NOTE_PREFIX_V590 = "__FLUXO_LAB_RICH_NOTE_V590__:";
const CORES_NOTA_V590 = new Set(["yellow", "red", "green", "blue"]);
const TAGS_PERIGOSAS_V590 = /<(script|style|iframe|object|embed|svg|math|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

function escaparTextoNotaV590(value) {
  return String(value).replace(/&(?!(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);)/gi, "&amp;");
}

function decodificarEntidadesNotaV590(value) {
  return String(value)
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_match, hex, decimal) => {
      const code = Number.parseInt(hex || decimal, hex ? 16 : 10);
      try {
        return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : "";
      } catch {
        return "";
      }
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function textoVisivelNotaV590(html) {
  const texto = String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?div\s*>/gi, "\n")
    .replace(/<\/?strong\s*>/gi, "")
    .replace(/<mark\s+data-cor="(?:yellow|red|green|blue)">/gi, "")
    .replace(/<\/mark>/gi, "")
    .replace(/<[^>]*>/g, "");
  return decodificarEntidadesNotaV590(texto);
}

export function sanitizeRichNoteHtml(input) {
  const source = String(input ?? "").slice(0, 100000).replace(TAGS_PERIGOSAS_V590, "");
  const tokens = source.match(/<!--[\s\S]*?-->|<\/?[a-zA-Z][^<>]*>|[^<]+|</g) || [];
  const stack = [];
  let html = "";

  for (const token of tokens) {
    if (token.startsWith("<!--")) continue;
    if (token === "<") {
      html += "&lt;";
      continue;
    }

    if (!token.startsWith("<")) {
      html += escaparTextoNotaV590(token);
      continue;
    }

    const match = token.match(/^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9:-]*)\b([^<>]*)>$/);
    if (!match) {
      html += escaparTextoNotaV590(token);
      continue;
    }

    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    const attrs = match[3] || "";

    if (tag === "br") {
      if (!closing) html += "<br>";
      continue;
    }

    let normalized = null;
    if (tag === "strong" || tag === "b") normalized = "strong";
    else if (tag === "mark") normalized = "mark";
    else if (tag === "div" || tag === "p") normalized = "div";
    if (!normalized) continue;

    if (closing) {
      const index = stack.lastIndexOf(normalized);
      if (index < 0) continue;
      for (let i = stack.length - 1; i >= index; i -= 1) {
        html += `</${stack.pop()}>`;
      }
      continue;
    }

    if (normalized === "strong") {
      html += "<strong>";
    } else if (normalized === "mark") {
      const colorMatch = attrs.match(/\bdata-cor\s*=\s*["'](yellow|red|green|blue)["']/i);
      const color = colorMatch && CORES_NOTA_V590.has(colorMatch[1].toLowerCase())
        ? colorMatch[1].toLowerCase()
        : "yellow";
      html += `<mark data-cor="${color}">`;
    } else {
      html += "<div>";
    }
    stack.push(normalized);
  }

  while (stack.length) html += `</${stack.pop()}>`;

  const text = textoVisivelNotaV590(html);
  return { html, text, length: text.length };
}

export function serializeRichNoteValue(input) {
  const parsed = sanitizeRichNoteHtml(input);
  const rawLength = String(input ?? "").length;
  const tooLong = rawLength > 100000 || parsed.length > 4000;
  return {
    value: tooLong ? null : RICH_NOTE_PREFIX_V590 + parsed.html,
    html: parsed.html,
    text: parsed.text,
    length: parsed.length,
    tooLong,
    empty: !parsed.text.trim()
  };
}

export function renderRichNoteValue(value, escapeHtml) {
  const stored = String(value ?? "");
  if (stored.startsWith(RICH_NOTE_PREFIX_V590)) {
    return sanitizeRichNoteHtml(stored.slice(RICH_NOTE_PREFIX_V590.length)).html;
  }
  return String(escapeHtml(stored))
    .replace(/\r\n?/g, "\n")
    .replace(/\n/g, "<br>");
}

export function countRichNoteCharacters(value) {
  const stored = String(value ?? "");
  if (stored.startsWith(RICH_NOTE_PREFIX_V590)) {
    return sanitizeRichNoteHtml(stored.slice(RICH_NOTE_PREFIX_V590.length)).length;
  }
  return stored.length;
}
