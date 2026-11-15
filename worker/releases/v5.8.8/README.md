# Fluxo Lab Worker V5.8.8

Fonte de desenvolvimento baseada na V5.8.7, com expansão segura da coleção de emblemas.

## Novidades

- **Missão Cumprida**: primeira tarefa atribuída por um usuário com perfil ADMINISTRADOR e concluída pelo próprio responsável. O prazo não interfere.
- **Pontualidade de Ouro**: 20 tarefas atribuídas por um ADMINISTRADOR, concluídas pelo próprio responsável até a data limite.
- Tarefas sem prazo não contam para pontualidade.
- Tarefas canceladas, reabertas ou concluídas pela liderança não contam.
- Os novos registros usam a tabela existente `emblemas_conquistas_v325`, com códigos exclusivos e `INSERT OR IGNORE`.
- Não há migração D1 nova nesta entrega. Histórico, conquistas antigas, produção e bonificações permanecem preservados.
- **Resgate Digital não faz parte do catálogo.**

## Base técnica

- Base: V5.8.7.
- Entrada: `index.js`.
- Módulos: 27.
- D1 homologação para testes; publicação de produção separada.
- Datas de tarefas interpretadas no fuso `America/Sao_Paulo`.

## Teste

Execute `npm run check` nesta pasta para validar a sintaxe de todos os módulos.
