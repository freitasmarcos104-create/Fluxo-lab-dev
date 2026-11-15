FLUXO LAB DESKTOP — WINDOWS (VERSÃO OFICIAL)

Cliente Electron que abre o sistema central do Fluxo Lab em janela própria.
URL oficial: https://app.markfree.com.br/

Na pasta desktop:
  npm install
  npm run dist:win
  npm run dist:portable

Saída: desktop/dist/.

O aplicativo usa a mesma versão de produção acessada pelo navegador e pelo Android. As atualizações de telas, regras, emblemas e dados são publicadas no servidor central e ficam disponíveis sem reconstruir o instalador.

Node integration permanece desativada; context isolation, sandbox e HTTPS permanecem ativados. A navegação interna é limitada ao host oficial. Links externos abrem no navegador padrão. A sessão fica no perfil local do aplicativo.

O instalador não tem assinatura digital de publicador e o Windows pode exibir um aviso.
