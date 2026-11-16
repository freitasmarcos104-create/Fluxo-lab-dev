# Fluxo Lab

Aplicação central do laboratório. Site, Windows e Android acessam o mesmo Worker de produção.

## Ambiente oficial

- Endereço: https://app.markfree.com.br/
- Worker: fluxo-lab
- Versão de referência sincronizada neste repositório: V5.8.8
- Código-fonte canônico: worker/
- Os clientes Windows e Android são apenas interfaces de acesso ao mesmo sistema web; não mantêm banco de dados independente.

## Caminho único de atualização

1. Desenvolver a alteração na pasta worker/ em uma branch.
2. Abrir Pull Request para main.
3. O GitHub Actions valida a sintaxe do Worker, a configuração Cloudflare e os testes automatizados.
4. Depois da aprovação e do merge em main, o Cloudflare Workers Builds publica a pasta worker/ no Worker fluxo-lab.
5. Alterações de telas, regras e funcionalidades web chegam aos três clientes sem reconstruir EXE ou APK.

O deploy é feito pelo Cloudflare Workers Builds usando a configuração versionada worker/cloudflare.config.ts e o comando npm run deploy. Não use o editor rápido da Cloudflare nem mantenha cópias de código paralelas.

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

Os identificadores e nomes dos bindings estão declarados em worker/cloudflare.config.ts. Não crie recursos substitutos nem altere esses vínculos sem migração e revisão humana.

## Testes

Com Node.js 22.18 ou superior:

- Na pasta worker/: npm install --no-package-lock e npm run check.
- Na raiz: node --test tests/worker-core.test.mjs.
- Na raiz: node --test tests/achievements.test.mjs.
- Na pasta worker/: npm run check:cf valida a configuração com dry-run e não publica.

## Regra de segurança

Nenhuma automação do repositório executa migrações D1, SQL em produção, operações R2 destrutivas ou alterações em dados do laboratório. Migrações continuam sendo procedimentos humanos separados.