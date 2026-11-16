# Fluxo Lab Worker V5.8.8

Fonte oficial do Worker de produção. O navegador, o aplicativo Windows e o aplicativo Android acessam o mesmo sistema:

- Endereço oficial: https://app.markfree.com.br/
- Worker: fluxo-lab
- Código-fonte de desenvolvimento: este diretório worker/
- Ponto de entrada: index.js
- Módulos do Worker: core/, domains/, routes/ e services/

## Caminho único de atualização

- Desenvolva em worker/ e abra Pull Request para main.
- GitHub Actions valida sintaxe, configuração e testes.
- Cloudflare Workers Builds acompanha main, usa esta pasta como root directory e publica o Worker após merge aprovado.
- O deploy executa npm run check e npm run deploy; o segundo chama cf deploy --mode production.
- Alterações da aplicação web chegam ao Windows e Android sem reconstruir os clientes.

Não edite este Worker pelo editor rápido da Cloudflare e não publique uma cópia paralela. Snapshots históricos estão em releases/.

## Bindings de produção

- AI: Workers AI.
- db: D1 fluxo-lab-db (1806ff34-36f6-4cfc-a6df-aa2f5e04b6c6).
- DOWNLOADS: R2 fluxo-lab-downloads.
- IMPORT_BUCKET: R2 fluxo-lab-importacoes.
- STL_BUCKET: R2 fluxo-lab-stl.

Não alterar os bindings nem criar recursos substitutos sem revisão humana. O pipeline não executa migrações D1, SQL em produção ou operações destrutivas R2.