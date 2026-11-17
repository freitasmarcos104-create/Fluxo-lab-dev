# Fluxo Lab Worker V5.12.0

Fonte oficial do Worker de produção. O navegador, o aplicativo Windows e o aplicativo Android acessam o mesmo sistema:

- Endereço oficial: https://app.markfree.com.br/
- Worker: fluxo-lab
- Código-fonte de desenvolvimento: este diretório worker/
- Ponto de entrada: index.js
- Módulos do Worker: core/, domains/, routes/, services/ e modules/

## Novidade da V5.12.0

O Almoxarifado passou a abrir dentro do layout padrão do Fluxo Lab, pela barra lateral de Operação do Laboratório. Funcionários comuns consultam materiais e enviam requisições; Almoxarifes e Administradores/Coordenadores têm gestão de estoque. O Almoxarife mantém acesso ao Espaço do Colaborador e ao chat próprio do setor, sem acesso às áreas de produção.

A migração `0003_v5120_almoxarifado_chat.sql` cria apenas a tabela de mensagens do chat do Almoxarifado.

## Novidade da V5.11.0

O funcionário com vínculo ativo de Almoxarife entra diretamente no painel do Almoxarifado. O Worker bloqueia o acesso às páginas e APIs gerais do laboratório para esse perfil, mantendo disponível a saída da conta e os recursos necessários ao aplicativo instalado. Administradores e Coordenadores preservam a navegação administrativa normal.

## Novidade da V5.9.0

A tela Minhas anotações agora oferece negrito e marca-texto amarelo, vermelho, verde e azul. A formatação é salva, sanitizada no servidor e preservada ao reabrir a anotação. As anotações antigas em texto puro continuam compatíveis.

Nenhuma migração D1 é necessária. O site, o Windows e o Android continuam conectados ao mesmo Worker e recebem a atualização pelo sistema central.

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
