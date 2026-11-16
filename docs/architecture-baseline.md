# Arquitetura oficial do Fluxo Lab

## Estado confirmado

- Versão-base de produção: V5.8.8.
- Worker oficial: fluxo-lab.
- Domínio: https://app.markfree.com.br/.
- Site, Windows e Android usam o mesmo Worker; os aplicativos nativos são clientes da aplicação web.
- Código de produção organizado em 27 módulos ES, com ponto de entrada worker/index.js e aplicação principal worker/legacy.js.

## Fonte de código

A raiz worker/ é a única fonte de verdade para desenvolvimento e publicação. Os diretórios worker/releases/v5.8.4 até worker/releases/v5.8.8 preservam snapshots históricos. O snapshot V5.8.8 foi conferido com o código multipart atualmente servido pelo Worker; o módulo legacy.js coincide com o conteúdo publicado após o cabeçalho de comentários removido pelo empacotamento.

A antiga pasta worker/ na raiz do branch main continha V4.0.0 e divergia da aplicação que estava no ar. Esta sincronização restaura o snapshot V5.8.8 como código ativo da raiz e mantém worker/modules/achievements.js e os testes do PR #11.

## Infraestrutura de produção

| Recurso | Nome / identificador |
|---|---|
| Worker | fluxo-lab |
| D1 | fluxo-lab-db |
| D1 ID | 1806ff34-36f6-4cfc-a6df-aa2f5e04b6c6 |
| R2 downloads | fluxo-lab-downloads |
| R2 importações | fluxo-lab-importacoes |
| R2 STL | fluxo-lab-stl |
| Workers AI | binding AI |

Os cinco bindings estão declarados em worker/cloudflare.config.ts. O Worker mantém compatibility date 2026-09-11, observabilidade habilitada e subdomínio workers.dev habilitado, conforme as configurações verificadas no Worker ativo.

## Publicação de versão

O Cloudflare Workers Builds acompanha a branch main do repositório freitasmarcos104-create/Fluxo-lab-dev, com root directory /worker, build command npm run check, deploy command npm run deploy e sem Preview deployments. Os caminhos worker/** iniciam builds. O deploy é feito pelo Cloudflare CLI cf usando a configuração tipada worker/cloudflare.config.ts.

GitHub Actions valida sintaxe e testes em Pull Requests. O merge aprovado em main é o único evento que publica uma atualização do Worker. O sistema web e os clientes Windows/Android passam a acessar automaticamente a mesma versão publicada.

## Segurança e limites

- Esta sincronização não altera schema D1, dados de pacientes, dados de produção ou arquivos R2.
- Migrações SQL são manuais e ficam fora do pipeline de deploy.
- Snapshots históricos em worker/releases/ não são editados.
- Não há Worker de homologação ativo. Não recriar um para contornar a fonte única.
- Mudanças no código nativo Windows/Android continuam separadas e só exigem novo EXE/APK quando forem realmente necessárias.