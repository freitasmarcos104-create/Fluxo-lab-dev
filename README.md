# Fluxo Lab — desenvolvimento

Repositório privado para evoluir o Fluxo Lab sem interromper a operação do laboratório.

## Segurança e ambientes
- Base importada: Worker V4.0.0, ambiente de homologação.
- Os clientes Windows e Android apontam somente para https://fluxo-lab-homologacao.trainingmav.workers.dev/.
- Nenhum workflow publica Worker ou altera D1/R2.
- Nunca enviar credenciais, tokens, cookies, chaves de assinatura, dados reais de pacientes ou arquivos STL reais.
- Nunca usar D1/R2 de produção em testes.
- Toda mudança em banco exige migração numerada, backup, revisão e plano de reversão. Não executar migrações automaticamente.

## Estrutura
- worker/: Worker Cloudflare, módulo principal e núcleo HTTP.
- desktop/: aplicativo Windows Electron.
- android/: aplicativo Android Java/WebView.
- tests/: testes automatizados.
- docs/: arquitetura, segurança e plano de validação.
- .github/workflows/: validação e compilação de EXE/APK.

## Estado inicial
A V4.0.0 faz uma primeira extração modular: index.js reexporta legacy.js e core/http.js contém cinco helpers HTTP/HTML. A maior parte das regras de negócio ainda está em legacy.js. Não é uma modularização completa.

Os aplicativos instaláveis são clientes que abrem o sistema web numa janela/tela própria. Precisam de internet e não são aplicativos totalmente offline.

## Testes
Com Node.js 22 ou superior:
- node --check worker/index.js
- node --check worker/legacy.js
- node --check worker/core/http.js
- node --test tests/worker-core.test.mjs

## Compilação
Abra Actions → Build Fluxo Lab installers → Run workflow. Os artefatos são EXE NSIS x64 e APK debug, ambos para homologação. Consulte docs/release-and-security.md antes de distribuir.

Leia CODEX.md antes de qualquer alteração feita por agente de IA.
