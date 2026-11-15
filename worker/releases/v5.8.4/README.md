# Fluxo Lab Worker V5.8.4

Fonte sincronizada do Worker modular atualmente validado em homologação.

- Snapshot original: Worker `fluxo-lab-homologacao`, versão 26.
- Snapshot criado em: 2026-11-15.
- Módulos: 27.
- Entrada principal: `index.js`.
- Runtime: Cloudflare Workers, compatibility date `2026-09-11`.
- Esta pasta é a fonte da versão V5.8.4. Não contém dados D1 nem arquivos STL.

## Ligações de ambiente

**Produção (Worker `fluxo-lab`)**
- `db` -> D1 `fluxo-lab-db`.
- `STL_BUCKET` -> R2 `fluxo-lab-stl`.
- `IMPORT_BUCKET` -> R2 `fluxo-lab-importacoes`.
- `AI` -> Workers AI.

**Homologação (Worker `fluxo-lab-homologacao`)**
- `db` -> D1 `fluxo-lab-homologacao`.
- `STL_BUCKET` -> R2 `fluxo-lab-homologacao-stl`.
- `IMPORT_BUCKET` -> R2 `fluxo-lab-homologacao-importacoes`.
- `AI` -> Workers AI.

Nunca publique o Worker de homologação apontando para o banco ou buckets de produção por engano.

## Segurança e migração

A autenticação de cada funcionário é feita pelo próprio Fluxo Lab. Não adicionar Cloudflare Access como login obrigatório dos funcionários.

Antes de promover a V5.8.4 para produção, aplicar a migração compatível que adiciona a coluna `ml_inicial` à tabela `potes_resina_v317` do banco de produção. A coluna existe na homologação e falta na produção; a consulta comparativa não encontrou outra diferença de schema.

Não copiar objetos R2 da homologação para produção: os buckets possuem a mesma quantidade de objetos, mas 17 objetos STL não são idênticos.

## Validar sintaxe

Na pasta desta versão, executar `npm run check`.
