FLUXO LAB DESKTOP — WINDOWS (HOMOLOGAÇÃO)

Cliente Electron que abre o Fluxo Lab em janela própria.
URL: https://fluxo-lab-homologacao.trainingmav.workers.dev/

Na pasta desktop:
  npm install
  npm run dist:win
  npm run dist:portable

Saída: desktop/dist/.

Node integration está desativada; context isolation, sandbox e HTTPS estão ativados. A navegação interna é limitada ao host de homologação e Cloudflare Access. Links externos abrem no navegador padrão. A sessão fica no perfil local do aplicativo.

O instalador não tem assinatura digital de publicador. O Windows pode exibir aviso. Não altere a URL para produção sem autorização.
