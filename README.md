# Fluxo Lab

Aplicação central do laboratório. Site, Windows e Android acessam o mesmo Worker de produção.

## Ambiente oficial

- Endereço: https://app.markfree.com.br/
- Worker: fluxo-lab
- Versão de referência sincronizada neste repositório: V5.8.8
- Código-fonte canônico: worker/
- Os clientes Windows e Android são interfaces de acesso ao mesmo sistema web; não mantêm banco de dados independente.

## Caminho único de atualização

1. Desenvolver a alteração na pasta worker/ em uma branch.
2. Abrir Pull Request para main.
3. O GitHub Actions executa a validação completa em Pull Requests e pushes: sintaxe, dry-run do Cloudflare e as três suítes de testes.
4. Após o merge em main, o Cloudflare Workers Builds executa exatamente o mesmo comando de validação e, somente se tudo passar, publica o Worker fluxo-lab.
5. O deploy usa worker/cloudflare.config.ts, preservando o Worker, D1, buckets R2 e domínio oficiais. GitHub Actions não publica em produção, evitando duas versões para o mesmo commit.
6. Alterações de telas, regras e funcionalidades web chegam aos clientes Windows e Android sem reconstruir EXE ou APK.

O token de publicação fica sob controle do Cloudflare Workers Builds. O GitHub Actions não precisa de CLOUDFLARE_API_TOKEN nem de permissão para alterar produção.

## Estrutura

- worker/: fonte de verdade do Worker de produção.
- worker/releases/: snapshots imutáveis de versões já publicadas, usados para auditoria e recuperação.
- worker/modules/: módulos puros e testáveis, incluindo o catálogo de emblemas.
- tests/: testes automatizados.
- docs/: arquitetura, segurança, migrações e procedimentos.
- desktop/ e android/: clientes nativos que abrem o endereço oficial.

## Recursos de produção vinculados

- D1: fluxo-lab-db.
- R2: fluxo-lab-downloads, fluxo-lab-importacoes e fluxo-lab-stl.
- Workers AI: binding AI.

Os identificadores e nomes dos bindings estão declarados em worker/cloudflare.config.ts. Não crie recursos substitutos nem altere esses vínculos sem revisão humana.

## Publicação e banco de dados

- `npm run deploy` publica somente o Worker.
- O pipeline não aplica migrações D1, não executa SQL em produção e não faz operações destrutivas no R2.
- Migrações D1 continuam sendo uma operação separada, revisada e executada explicitamente.

## Testes

Com Node.js 22.18 ou superior:

- Na pasta worker/: npm install --no-package-lock e npm run validate:release.
- O comando reúne sintaxe, dry-run Cloudflare e testes de núcleo, emblemas e segurança do pipeline.
