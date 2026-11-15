# Snapshot antes da promoção do Fluxo Lab

- Data: 2026-11-15
- Worker de produção preservado: `fluxo-lab` (código legado V3.25.2).
- Worker de homologação preservado: `fluxo-lab-homologacao` (V5.8.4 modular).
- Banco de produção: `fluxo-lab-db`.
- Banco de homologação: `fluxo-lab-homologacao`.
- Bookmark D1 de produção antes da migração: `00000697-00000000-00005124-7900298d94b9ad9eb5e19b5f4066b60f`.
- Exportação D1 SQL concluída pela API do Cloudflare. O link temporário expira em 1 hora; pode ser regenerado pela API se necessário.
- Única diferença de schema detectada: a tabela `potes_resina_v317` tem a coluna `ml_inicial` na homologação, mas não na produção.
- Os buckets STL têm 18 objetos em cada ambiente, mas 17 objetos não correspondem exatamente; não copiar arquivos de homologação para produção.
- Nenhum Worker, banco ou bucket foi apagado nesta etapa.