# Fluxo Lab V5.10.0 — Almoxarifado

## Objetivo
Adicionar ao Worker oficial o setor Almoxarifado, compartilhado pelo site, Windows e Android. A interface nativa continua sendo cliente da mesma aplicação; não há banco ou Worker paralelo.

## Modelo de dados
- almoxarifado_itens: cadastro do produto, unidade única (mL, g ou un), local padrão, mínimo e controle de lote.
- almoxarifado_lotes: lote externo ou lote interno de recebimento, validade, localização, fornecedor, documento, data e situação.
- almoxarifado_movimentos: livro imutável de entradas, saídas, perdas, vencimentos, transferências e ajustes.
- almoxarifado_requisicoes e almoxarifado_requisicao_itens: pedidos dos setores e quantidades solicitadas.
- Views almoxarifado_saldos_lotes e almoxarifado_saldos_itens calculam o saldo a partir dos movimentos.

## Regras implementadas
- O saldo não é editável e não é armazenado como número independente. O painel separa saldo físico total de saldo disponível; lotes vencidos, em quarentena ou bloqueados não contam como disponíveis.
- Triggers D1 bloqueiam saldo negativo, saídas de lotes vencidos/quarentena/bloqueados e atendimento acima do pedido.
- Lotes disponíveis são sugeridos por FEFO; lotes sem validade ficam depois dos que têm vencimento. Reagentes, padrões e kits exigem rastreabilidade de lote e validade; consumíveis genéricos podem usar lote interno.
- Ajustes, perdas e vencimentos exigem motivo; movimentos não podem ser alterados ou apagados. Transferências registram origem e destino e movem o lote inteiro, pois cada lote mantém uma única localização.
- Material sem controle de lote recebe um lote interno de recebimento para manter a origem da quantidade sem exigir rastreio externo.
- Funcionários autenticados podem abrir requisições apenas nos setores vinculados à conta (`setores_v31`), com fallback para o setor legado do usuário. A aba Equipe, exclusiva de Administrador/Coordenador, permite criar uma conta de Almoxarife sem setores produtivos ou atribuir a função a um funcionário existente. O vínculo fica em `almoxarifado_equipe`, separado de `usuario_areas` e `usuario_setores`; somente Admin/Coord e Almoxarifes ativos podem gerir o estoque. Remover a função desativa apenas o vínculo, sem excluir a conta nem apagar o histórico.
- Equipamentos patrimoniais não entram no estoque.

## Telas
Painel, Itens, Entrada, Requisições, Lotes, Movimentos, Inventário e ficha individual do item.

## Fora do escopo desta entrega
Compras e cotações, NF-e, custo médio, curva ABC, múltiplos almoxarifados, conversão de unidades e baixa automática de consumo por etapa do trabalho.

## Integração futura com produção
O campo de origem do movimento permite associar saídas a requisições ou trabalhos. A baixa de consumo por receita/método deve ser uma etapa posterior, iniciando como sugestão e exigindo confirmação humana. Não será feita baixa automática de material quando uma etapa for concluída nesta primeira implantação.

## Migração e publicação
A migração 0002_v5100_almoxarifado.sql é aditiva e deve ser revisada antes da aplicação no D1 oficial fluxo-lab-db. Este PR não executa SQL em produção nem publica o Worker. O deploy continua pelo único fluxo oficial após aprovação e merge.

## Cadastro de equipe do Almoxarifado
- Painel adicional na aba administrativa Equipe (/funcionarios).
- Administrador ou Coordenador pode criar uma conta dedicada ao Almoxarifado ou atribuir a função a um funcionário existente.
- A conta dedicada recebe perfil FUNCIONARIO e os campos legados setor/área com valor ALMOXARIFADO, sem linhas em usuario_areas ou usuario_setores; assim não ganha acesso às filas de produção.
- A função fica em almoxarifado_equipe. Somente vínculo ativo concede gestão de estoque.
- Remover a função desativa apenas o vínculo; não exclui a conta e preserva o histórico.
