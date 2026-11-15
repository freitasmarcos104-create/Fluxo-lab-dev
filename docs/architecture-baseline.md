# Diagnóstico da base inicial

Base importada: Fluxo Lab V4.0.0 (14/11/2026), ambiente de homologação.

## Componentes existentes
- worker/index.js: ponto de entrada ES Module.
- worker/legacy.js: aplicação principal preservada, derivada da V3.25.2.
- worker/core/http.js: cabecalhosSegurancaV30, htmlResponse, textResponse, redirect e escapeHtml.
- desktop/: cliente Electron configurado para homologação.
- android/: cliente Java/WebView configurado para homologação.

## Limites conhecidos
- A maior parte da aplicação ainda está em legacy.js; a modularização é inicial.
- A interface é majoritariamente gerada no servidor.
- Os clientes encapsulam a aplicação web e precisam de conexão.
- O Cloudflare Access da homologação estava limitado à conta administrativa no relatório de origem. Testar em dispositivo real antes de distribuir.
- O relatório V4.0.0 indicava publicação validada no Worker de homologação; login e navegação humana ainda precisavam de validação.

## Infraestrutura
A homologação usa recursos separados de produção: D1 fluxo-lab-homologacao, R2 fluxo-lab-homologacao-stl, R2 fluxo-lab-homologacao-importacoes e Workers AI. Não copiar identificadores ou bindings de produção para testes.

## Próximas extrações candidatas
Autenticação/sessão, auditoria, produção, arquivos, equipe, metas e espaço do colaborador. Cada extração exige teste de equivalência e revisão de permissões. Não criar módulos vazios apenas para aparentar modularização.
