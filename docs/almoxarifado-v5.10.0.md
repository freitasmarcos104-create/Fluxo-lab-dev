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
- O saldo não é editável e não é armazenado como número independente.
- Triggers D1 bloqueiam saldo negativo, saídas de lotes vencidos/quarentena/bloqueados e atendimento acima do pedido.
- Lotes disponíveis são sugeridos por FEFO; lotes sem validade ficam depois dos que têm vencimento.
- Ajustes exigem motivo; movimentos não podem ser alterados ou apagados.
- Material sem controle de lote recebe um lote interno de recebimento para manter a origem da quantidade sem exigir rastreio externo.
- Funcionários autenticados podem abrir requisições. Cadastro, recebimento, atendimento, transferência, inventário e controle dos lotes ficam inicialmente restritos a ADMINISTRADOR e COORDENADOR.
- Equipamentos patrimoniais não entram no estoque.

## Telas
Painel, Itens, Entrada, Requisições, Lotes, Movimentos, Inventário e ficha individual do item.

## Fora do escopo desta entrega
Compras e cotações, NF-e, custo médio, curva ABC, múltiplos almoxarifados, conversão de unidades e baixa automática de consumo por etapa do trabalho.

## Integração futura com produção
O campo de origem do movimento permite associar saídas a requisições ou trabalhos. A baixa de consumo por receita/método deve ser uma etapa posterior, iniciando como sugestão e exigindo confirmação humana. Não será feita baixa automática de material quando uma etapa for concluída nesta primeira implantação.

## Migração e publicação
A migração 0002_v5100_almoxarifado.sql é aditiva e deve ser revisada antes da aplicação no D1 oficial fluxo-lab-db. Este PR não executa SQL em produção nem publica o Worker. O deploy continua pelo único fluxo oficial após aprovação e merge.
