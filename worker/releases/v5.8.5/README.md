# Fluxo Lab Worker V5.8.5

Fonte do Worker principal com a correção de experiência em celulares.

- Base funcional: V5.8.4.
- Versão de interface: V5.8.5.
- Data: 2026-11-15.
- Módulos: 27.
- Entrada: `index.js`.
- Compatibilidade Cloudflare Workers: `2026-09-11`.

## O que mudou
- Cabeçalho do celular reorganizado em duas linhas.
- Título da página deixa de quebrar letra por letra.
- Botões do cabeçalho compactados.
- Indicadores da fila Digital passam a usar dois cartões por linha em telas pequenas.
- Tipografia e espaçamentos da área principal compactados.
- Cache do Service Worker atualizado para carregar a nova folha de estilos.

## O que não mudou
- Regras de produção, permissões e cálculos.
- Login próprio dos funcionários.
- Banco D1 e arquivos R2.
- Layout do desktop: os ajustes novos estão limitados a telas de até 600px.

## Recursos de produção
- D1: `fluxo-lab-db`
- R2 de arquivos STL: `fluxo-lab-stl`
- R2 de importações: `fluxo-lab-importacoes`
- Workers AI: binding `AI`

## Validação
Execute `npm run check` para verificar a sintaxe de todos os módulos.
