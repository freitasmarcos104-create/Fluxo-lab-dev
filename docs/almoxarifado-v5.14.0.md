# Fluxo Lab V5.14.0 — Almoxarifado simples e estoque da Impressão

## Objetivo
Simplificar o registro de materiais e separar o saldo central do Almoxarifado do saldo sob responsabilidade do setor de Impressão.

## Cadastro e entrada
- Código do material é opcional; quando vazio, o sistema gera uma identificação interna.
- RESINA passa a ser um tipo disponível no catálogo.
- Localização padrão e estoque mínimo deixam de ser solicitados.
- Quantidades operacionais são inteiras (1, 2, 3...).
- Lote, validade e fornecedor são opcionais.
- Novas entradas são lançadas diretamente no estoque do Almoxarifado.

## Dois estoques
- ALMOXARIFADO: estoque central, administrado pela equipe do Almoxarifado.
- IMPRESSAO: estoque do Digital sob controle dos funcionários vinculados ao setor de Impressão.
- Uma transferência parcial registra uma saída no estoque central e uma entrada correspondente no estoque da Impressão, mantendo vínculo com o lote original.
- O funcionário da Impressão registra o consumo no endereço interno /digital/estoque.
- A operação de transferência não exige motivo; perdas e descartes continuam exigindo justificativa.

## Exemplo
Entrada de 6 potes no Almoxarifado:
- Almoxarifado: 6
- Impressão: 0

Transferência de 1 pote:
- Almoxarifado: 5
- Impressão: 1
- Total: 6

Quando a Impressão registra o uso de 1 pote:
- Almoxarifado: 5
- Impressão: 0
- Total: 5

## Preservação e publicação
A migração `0005_v5140_estoque_impressao.sql` acrescenta campos às tabelas existentes e mantém os registros históricos. A migração deve ser revisada e aplicada no D1 oficial antes da publicação do Worker V5.14.0. O deploy continua pelo único fluxo de atualização do Fluxo Lab.
