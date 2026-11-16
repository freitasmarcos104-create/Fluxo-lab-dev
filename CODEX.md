# Instruções para agentes de desenvolvimento

## Objetivo

Evoluir o Fluxo Lab oficial com uma única fonte de código e um único caminho de publicação. Site, Windows e Android usam o Worker produção fluxo-lab em https://app.markfree.com.br/.

## Fonte de verdade e versões

1. O código ativo do Worker fica em worker/. Esta pasta deve corresponder à versão implantada em produção.
2. worker/releases/vX.Y.Z/ contém snapshots históricos imutáveis. Nunca desenvolva diretamente dentro desses snapshots.
3. Não reintroduza a antiga base V4.0.0 identificada como homologação. A homologação foi desativada; o Worker oficial é fluxo-lab, V5.8.8 como baseline.
4. Não crie outro Worker, domínio, D1 ou bucket para resolver divergências de código.
5. Windows e Android são clientes do endereço oficial. Não reconstruir EXE/APK para mudanças que pertencem ao Worker web.

## Publicação

1. Faça alterações em branch própria e abra Pull Request para main.
2. O CI valida worker/ e os testes da raiz.
3. Cloudflare Workers Builds é o único publicador do Worker. Seu root directory é /worker; build command: npm run check; deploy command: npm run deploy.
4. A configuração do Worker usa Cloudflare CLI (cf) e worker/cloudflare.config.ts. Não criar wrangler.toml, wrangler.json ou wrangler.jsonc e não usar upload manual pelo painel.
5. Não execute deploy manualmente. O deploy ocorre somente pelo fluxo controlado de merge em main.
6. Mudanças em desktop/ ou android/ só exigem novos instaladores quando alterarem código nativo.

## Regras obrigatórias

1. Trate worker/legacy.js como fonte do comportamento legado. Prefira alterações pequenas e cobertas por testes.
2. Não remova nem altere rotas, permissões, cálculos de produção, metas, ranking, bonificações, auditoria ou fluxos de arquivos sem solicitação específica.
3. Não execute migrações D1, SQL em banco real, operações R2 destrutivas ou qualquer ação de produção que altere dados.
4. Preserve os bindings de produção declarados em worker/cloudflare.config.ts: AI, db, DOWNLOADS, IMPORT_BUCKET e STL_BUCKET.
5. Nunca armazene segredos, tokens, cookies, keystore ou chaves privadas no código. Não peça ao usuário para colá-los.
6. Não inclua dados reais de pacientes, funcionários, STL, relatórios ou sessões em testes, logs ou exemplos.
7. Mudanças pequenas em branch própria. Inclua testes, risco, procedimento de validação e rollback.
8. Antes de mudar o banco, inventarie o schema e apresente migração numerada, backup, validação e rollback. Não execute a migração.
9. Trate uploads/downloads, cookies e autenticação como fluxos críticos. Não enfraqueça validações de host ou HTTPS.
10. Não afirme que EXE/APK foi validado sem executar o workflow e inspecionar artefatos e logs.

## Fluxo de trabalho

Leia README.md e docs/architecture-baseline.md; verifique worker/ e os testes; crie branch; implemente; rode npm run check em worker/ e os testes da raiz; abra Pull Request. Aguarde a aprovação humana antes do merge. O merge em main aciona o único deploy automático do Worker.