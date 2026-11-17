FLUXO LAB WORKER V5.8.8 — FONTE OFICIAL DE PRODUÇÃO

Este diretório é a única fonte de código do Worker oficial.

Worker: fluxo-lab
Endereço: https://app.markfree.com.br/
Entrada: index.js
Aplicação principal: legacy.js
Configuração Cloudflare: cloudflare.config.ts

WEB, WINDOWS E ANDROID ACESSAM O MESMO WORKER. Os clientes instaláveis não possuem backend nem banco independente.

DESENVOLVIMENTO
1. Trabalhe nesta pasta worker/.
2. Execute npm install --no-package-lock e npm run check.
3. Na raiz do repositório, execute os testes descritos no README.md.
4. Abra Pull Request para main.
5. Após aprovação e merge, Cloudflare Workers Builds publica o Worker automaticamente.

PUBLICAÇÃO
O comando de deploy é npm run deploy (cf deploy --mode production). Não execute manualmente. O pipeline oficial é Cloudflare Workers Builds, branch main, root directory /worker.

RECURSOS VINCULADOS
D1: fluxo-lab-db.
R2: fluxo-lab-downloads, fluxo-lab-importacoes, fluxo-lab-stl.
Workers AI: AI.

Não alterar bindings, domínio, recursos de produção ou schema D1 sem revisão humana. Os snapshots históricos estão em releases/ e não devem ser editados.