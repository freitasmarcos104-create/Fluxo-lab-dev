# Expansão de emblemas — Fluxo Lab

## Escopo
Catálogo aditivo de 50 conquistas profissionais em sete categorias: CAD/CAM, trabalhos manuais, fatiamento, impressão 3D, acabamento, organização/limpeza e agenda.

## Implementação desta etapa
- `worker/modules/achievements.js`: catálogo versionado, sete raridades principais, progresso e avaliação pura por métricas agregadas.
- `tests/achievements.test.mjs`: testes de quantidade, IDs, categorias, raridades e desbloqueio.
- Nenhuma rota, tabela D1, permissão, cálculo de produção ou registro existente foi alterado.
- O módulo ainda precisa ser conectado à tela de emblemas e às fontes reais de métricas do Worker. Eventos manuais exigem validação autorizada; não podem ser simulados pelo contador do usuário.
- A coleção anterior permanece separada e não é substituída.

## Integração pendente
1. Inventariar schema D1 de homologação e a tela/rota atual de conquistas.
2. Definir origem confiável de cada métrica e regra de atribuição por funcionário.
3. Apresentar migração SQL numerada com backup, validação e rollback, se a persistência exigir novas tabelas.
4. Conectar a interface responsiva, preservando desktop e Android que consomem a mesma aplicação web.
5. Executar testes e homologação antes de qualquer publicação.

## Segurança de release
Não executar migrações D1 nem deploy nesta etapa. O ambiente de clientes continua em homologação até aprovação humana.
