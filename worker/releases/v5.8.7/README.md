# Fluxo Lab Worker V5.8.7

Fonte do Worker principal publicado em 15 de novembro de 2026.

- Base: V5.8.6.
- Versão: V5.8.7.
- Módulos: 27.
- Entrada: `index.js`.
- Compatibility date: `2026-09-11`.

## Downloads oficiais

O Worker usa o binding R2 `DOWNLOADS`, ligado ao bucket privado `fluxo-lab-downloads`.

- `GET /downloads/windows` entrega `current/Fluxo-Lab-Setup-0.1.4.exe`.
- `GET /downloads/android` entrega `current/Fluxo-Lab-Android-0.1.4.apk`.

As rotas entregam somente esses dois instaladores. Não há listagem pública do bucket. Banco D1, arquivos STL, importações, login e dados do laboratório continuam protegidos.

## Ligações de produção

- D1: `fluxo-lab-db`.
- R2 STL: `fluxo-lab-stl`.
- R2 importações: `fluxo-lab-importacoes`.
- R2 downloads: `fluxo-lab-downloads`.
- Workers AI: binding `AI`.

## Teste

- `https://app.markfree.com.br/downloads/windows`
- `https://app.markfree.com.br/downloads/android`
