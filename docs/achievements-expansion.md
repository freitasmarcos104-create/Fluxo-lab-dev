# Emblemas — catálogo 2.0.0 (somente o que pode ser comprovado)

## Regra de ouro

Um emblema só entra se existir uma forma de **comprovar** que a pessoa o merece:
1. **Dado que o sistema já registra** (produção, semanas com meta atingida, tarefas); ou
2. **Reconhecimento de um administrador**, guardado com quem concedeu, quando e por quê.

Contador que o próprio funcionário altera, autodeclaração e emblemas sem fonte confiável ficam de fora.

## O que muda em relação ao catálogo 1.0.0 (PR #9)

O catálogo 1.0.0 tinha 50 emblemas, mas **nenhum estava ligado à tela** e a maioria dependia de dados que o sistema não tem. Agora:

- **8 emblemas automáticos** (sem tabela nova);
- **7 emblemas de organização e limpeza** concedidos por administrador (1 tabela nova);
- **43 emblemas adiados** (lista abaixo).

## 1. Expansão automática (sem migração)

Usam as mesmas fontes de dados e a mesma tabela `emblemas_conquistas_v325` que os emblemas atuais. O formato dos itens é o mesmo dos arrays `EMBLEMAS_PRODUCAO_V325`, `EMBLEMAS_SEQUENCIA_V325` e `EMBLEMAS_TAREFAS_V326` do `legacy.js`.

| Código | Título | Regra |
|---|---|---|
| PRODUCAO_1000 | Milhar de produção | 1.000 unidades concluídas |
| PRODUCAO_1500 | Mestre da produção | 1.500 unidades concluídas |
| PRODUCAO_2000 | Titã da produção | 2.000 unidades concluídas |
| META_8_SEMANAS | Disciplina de platina | 8 semanas consecutivas com a meta atingida |
| META_12_SEMANAS | Trimestre perfeito | 12 semanas consecutivas com a meta atingida |
| AGENDA_CONCLUIDAS_25 | Rotina em dia | 25 tarefas de administrador concluídas |
| AGENDA_PONTUALIDADE_50 | Pontualidade de Platina | 50 tarefas concluídas no prazo |
| AGENDA_PONTUALIDADE_100 | Pontualidade de Diamante | 100 tarefas concluídas no prazo |

Os códigos foram conferidos contra os existentes em produção (V5.8.8) e não colidem. `emblemas_conquistas_v325` tem `UNIQUE (usuario_id, codigo)`.

## 2. Organização e limpeza (concedidos por administrador)

O administrador registra um **reconhecimento** para um funcionário (tipo, data, setor, observação). O emblema é liberado quando o funcionário acumula a quantidade necessária de reconhecimentos **válidos** (não revogados).

| Código | Título | Raridade | Regra |
|---|---|---|---|
| ORG_BANCADA_PREPARADA | Bancada Preparada | Comum | 5 dias com abertura de bancada aprovada |
| ORG_FECHAMENTO_IMPECAVEL | Fechamento Impecável | Bronze | 5 dias com fechamento de bancada aprovado |
| ORG_FERRAMENTAL_ORGANIZADO | Ferramental Organizado | Prata | 10 auditorias de ferramental aprovadas |
| ORG_ESTOQUE_IDENTIFICADO | Estoque Identificado | Prata | 10 auditorias de estoque aprovadas |
| ORG_DESCARTE_RESPONSAVEL | Descarte Responsável | Ouro | 10 descartes corretos registrados |
| ORG_SALA_5S | Sala 5S | Platina | 4 semanas de 5S aprovadas (semana = segunda a domingo) |
| ORG_GUARDIAO_AMBIENTE | Guardião do Ambiente | Lendário | 6 meses seguidos com auditoria mensal aprovada |

Regras de segurança (validadas em `validarReconhecimento` e, no banco, por `CHECK`):
- o administrador **não pode conceder a si mesmo**;
- a data não pode ser futura e precisa ser uma data real;
- o tipo precisa estar na lista fixa;
- não existem dois reconhecimentos **ativos** iguais (mesmo funcionário, tipo, data e setor);
- a revogação exige autor e motivo; depois de revogado, pode-se conceder de novo.

Decisão de produto: o emblema continua **permanente**, como a página já informa. Revogar um reconhecimento afeta apenas os próximos cálculos e não remove um emblema já conquistado. Se a regra for outra, este é o ponto a ajustar antes da integração.

## 3. Emblemas adiados (43)

Ficam fora porque o sistema não registra o dado ou ninguém o valida hoje. Podem voltar se surgir uma fonte comprovável.

- **CAD/CAM (8):** Arquivo Completo, Planejamento Digital, Malha Validada, Margem Conferida, Oclusão Revisada, Biblioteca Correta, Fluxo Digital Completo, Resgate Digital.
- **Trabalhos manuais (7):** Mão na Massa, Montagem Anatômica, Escultura de Detalhe, Ajuste Oclusal Manual, Reparo de Precisão, Técnica Multimaterial, Artesão de Excelência.
- **Fatiamento (7):** Perfil Configurado, Suportes Bem Planejados, Orientação Inteligente, Bandeja Organizada, Aproveitamento de Plataforma, Pré-voo Digital, Fatiamento Rastreável.
- **Impressão 3D (8):** Partida Segura, Cuba Inspecionada, Plataforma Verificada, Resina Rastreada, Bandeja Integral, Pós-processamento Padrão, Manutenção Preventiva 3D, Guardião da Impressora.
- **Acabamento (7):** Remoção Cuidadosa, Anatomia Preservada, Linha de União Discreta, Polimento Uniforme, Adaptação Conferida, Inspeção Final 360°, Pronto para Entrega.
- **Agenda (6):** Planejamento Semanal, Compromisso Confirmado, Pontualidade de Agenda (duplica o emblema já existente), Agenda sem Conflitos, Pendências Resolvidas, Retorno Programado.

Possíveis candidatos a reavaliação futura, se os registros existentes comprovarem: Resina Rastreada e Fatiamento Rastreável (o banco já tem tabelas de resina, consumo de materiais e eventos de pacotes digitais). Isso exige inventariar colunas e regras antes de qualquer decisão.

## Esta etapa (PR 1) — o que contém

- `worker/modules/achievements.js`: catálogo 2.0.0, avaliação (`avaliarEmblemasAdmin`) e validação (`validarReconhecimento`). Módulo puro, sem acesso a banco.
- `tests/achievements.test.mjs`: 15 testes.
- `docs/migracoes/MIGRACAO_D1_V5.9.0_EMBLEMAS_RECONHECIMENTOS.sql` e o `..._ROLLBACK.sql`.

Nada disso altera rotas, tabelas existentes, permissões, produção, metas, ranking ou bonificação. **O PR 1 não muda o comportamento do sistema:** o módulo ainda não é importado pelo Worker.

## PR 2 — integração (pendente)

Mexe no `legacy.js` e por isso deve ser feita com ferramenta que edite o arquivo localmente e rode os testes:

1. Acrescentar os arrays de expansão aos arrays existentes nas listas usadas por `calcularResumoEmblemasV325` e `paginaEmblemasV325`. Confirmar que a gravação em `emblemas_conquistas_v325` e a notificação usam apenas `codigo`, `categoria`, `titulo` e `descricao`.
2. Nova seção "Organização e limpeza" na página `/emblemas`, alimentada por `avaliarEmblemasAdmin`.
3. Tela só para administradores (`isCoord`) para conceder e revogar reconhecimentos, com `validarReconhecimento`, registro em `auditoria_sistema_v31` e aviso na Central de Notificações.
4. Testes de caracterização das rotas, preservando desktop e Android, que consomem a mesma aplicação web.

## Procedimento da migração (humano, fora do repositório)

1. Fazer backup do D1 (export ou marcador do Time Travel) e guardar o identificador.
2. Revisar o SQL. Aplicar fora do horário de produção.
3. Executar `MIGRACAO_D1_V5.9.0_EMBLEMAS_RECONHECIMENTOS.sql`.
4. Só depois publicar o Worker com a integração do PR 2.
5. Para desfazer: `MIGRACAO_D1_V5.9.0_EMBLEMAS_RECONHECIMENTOS_ROLLBACK.sql`.

## Limitações conhecidas

- A classificação do que é comprovável foi feita a partir dos nomes das tabelas e do código publicado, sem acesso a dados reais.
- As metas (1.000/1.500/2.000 unidades, 8/12 semanas, 25/50/100 tarefas e os valores dos emblemas de organização) são propostas e podem ser ajustadas.
- O SQL foi validado em SQLite, que é a base do D1, mas ainda não foi executado no D1 real.
