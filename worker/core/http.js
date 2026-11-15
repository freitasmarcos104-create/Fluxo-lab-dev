// FLUXO LAB V4.0.0 — CORE HTTP
// Helpers compartilhados extraídos da V3.25.2, sem alteração de comportamento.

export function cabecalhosSegurancaV30(tipo = "text/html; charset=UTF-8") {
  return {
    "content-type": tipo,
    "cache-control": "no-store, max-age=0",
    "pragma": "no-cache",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "same-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "x-robots-tag": "noindex, nofollow, noarchive",
    "strict-transport-security": "max-age=31536000; includeSubDomains"
  };
}

export function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: cabecalhosSegurancaV30("text/html; charset=UTF-8")
  });
}

export function textResponse(text, status = 200) {
  return new Response(text, {
    status,
    headers: cabecalhosSegurancaV30("text/plain; charset=UTF-8")
  });
}

export function redirect(url, cookie = null) {
  const headers = {
    ...cabecalhosSegurancaV30("text/plain; charset=UTF-8"),
    Location: url
  };

  if (cookie) {
    headers["Set-Cookie"] = cookie;
  }

  return new Response(null, {
    status: 302,
    headers
  });
}

export function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}