# Fluxo Lab Worker V5.8.8

Fonte oficial do Worker de produção. O navegador, o aplicativo Windows e o aplicativo Android acessam o mesmo sistema:

- Endereço oficial: https://app.markfree.com.br/
- Worker: fluxo-lab
- Código-fonte de desenvolvimento: este diretório worker/
- Ponto de entrada: index.js
- Módulos do Worker: core/, domains/, routes/ e services/

## Caminho único de atualização

- Desenvolva em worker/ e abra Pull Request para main.
- GitHub Actions valida sintaxe, configuração Cloudflare e testes.
- Depois do merge aprovado em main, o job deploy-production publica esta pasta no Worker fluxo-lab.
- O deploy usa o Cloudflare CLI (cf) e a configuração cloudflare.config.ts.
- O único segredo exigido pelo pipeline é CLOUDFLARE_API_TOKEN, armazenado nos Actions Secrets do GitHub.
- Alterações da aplicação web chegam ao Windows e Android sem reconstruir os clientes.

Não edite este Worker pelo editor rápido da Cloudflare e não publique uma cópia paralela. Snapshots históricos estão em releases/.

## Publicação e migrações

- `npm run deploy` executa somente `cf deploy --mode production --force`.
- O deploy não executa migrações D1, SQL em produção ou operações destrutivas R2.
- Migrações são etapas manuais e independentes, com revisão própria.

## Bindings de produção

- AI: Workers AI.
- db: D1 fluxo-lab-db (1806ff34-36f6-4cfc-a6df-aa2f5e04b6c6).
- DOWNLOADS: R2 fluxo-lab-downloads.
- IMPORT_BUCKET: R2 fluxo-lab-importacoes.
- STL_BUCKET: R2 fluxo-lab-stl.

Não alterar os bindings nem criar recursos substitutos sem revisão humana.
