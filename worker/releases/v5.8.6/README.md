# Fluxo Lab Worker V5.8.6

Fonte do Worker principal com downloads nativos dos instaladores.

- Base funcional: V5.8.5.
- Versão: V5.8.6.
- Data: 2026-11-15.
- Módulos: 27.
- Entrada: `index.js`.
- Compatibilidade Cloudflare Workers: `2026-09-11`.

## Downloads dos aplicativos

A versão adiciona o binding R2 `DOWNLOADS`, conectado ao bucket privado `fluxo-lab-downloads`.

Rotas públicas, restritas somente a dois arquivos de instalação:
- `GET /downloads/windows` -> objeto `current/windows.exe`.
- `GET /downloads/android` -> objeto `current/android.apk`.

As rotas entregam o arquivo com `Content-Disposition: attachment`. Não expõem listagem do bucket. Os caminhos públicos não dão acesso ao banco nem aos arquivos de pacientes.

## Tela de instalação

- Remove o botão de instalação PWA do Edge/Chrome.
- Mantém o registro do Service Worker para atualização/cache do site.
- Exibe downloads separados para Windows (.EXE) e Android (.APK), na tela de login e no início do sistema.

## Recursos de produção

- D1: `fluxo-lab-db`
- R2 STL: `fluxo-lab-stl`
- R2 importações: `fluxo-lab-importacoes`
- R2 downloads: `fluxo-lab-downloads`
- Workers AI: binding `AI`

## Segurança

O login dos funcionários continua sendo o login próprio do Fluxo Lab. Os downloads são os únicos recursos públicos adicionados; nenhum arquivo de paciente é publicado.
