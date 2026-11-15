# Instruções para agentes de desenvolvimento

## Objetivo
Evoluir o Fluxo Lab gradualmente, preservando a operação existente e tornando o código testável e instalável.

## Regras obrigatórias
1. Trate worker/legacy.js como fonte de comportamento existente. Não reescreva módulos inteiros sem necessidade comprovada.
2. Não remova nem altere rotas, permissões, cálculos de produção, metas, ranking, bonificações, auditoria ou fluxos de arquivos sem solicitação específica.
3. Não execute wrangler deploy, migrações D1, operações R2 ou qualquer ação destrutiva. Produção permanece fora deste repositório.
4. A URL dos clientes deve permanecer em homologação até aprovação explícita: https://fluxo-lab-homologacao.trainingmav.workers.dev/.
5. Não armazene segredos no código. Nunca peça ao usuário para colar senhas, tokens, cookies, keystore ou chaves privadas.
6. Não adicione dados reais de pacientes, funcionários, STL, relatórios ou sessões aos testes, logs ou exemplos.
7. Faça mudanças pequenas em branch própria. Inclua testes e descrição do risco. Prefira Pull Request a commits diretos em main.
8. Antes de propor mudança no banco, inventarie o schema e apresente migração SQL numerada, backup, validação e rollback. Não executar migração.
9. Trate uploads/downloads, cookies e autenticação Cloudflare Access como fluxos críticos. Não enfraqueça validações de host ou HTTPS.
10. Não afirme que EXE/APK foi validado sem executar o workflow e inspecionar artefatos e logs.

## Fluxo esperado
Leia README.md e docs/architecture-baseline.md; mapeie dependências; crie testes de caracterização; proponha plano; implemente em branch; rode node --check e node --test; atualize documentação; abra Pull Request. Aguarde validação humana antes de merge, deploy ou release.
