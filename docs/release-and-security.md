# Distribuição e segurança

## Aplicação oficial

- Site: https://app.markfree.com.br/.
- Worker central: fluxo-lab.
- Windows e Android: clientes do mesmo sistema web central, versão dos instaladores 0.1.5.
- Atualizações de telas, regras, emblemas, agenda e dados acontecem no Worker. Não é necessário reconstruir os instaladores para essas mudanças.

## Publicação

1. Alterações do Worker ficam em worker/.
2. Pull Requests executam validação de sintaxe, configuração Cloudflare e testes.
3. O merge aprovado em main aciona Cloudflare Workers Builds.
4. Workers Builds executa npm run check e npm run deploy na pasta worker/.
5. O comando npm run deploy chama cf deploy --mode production.

Não publique pelo editor rápido da Cloudflare, não envie outra cópia de legacy.js e não atualize o Worker por caminhos paralelos.

## Recursos preservados

- D1: fluxo-lab-db.
- R2: fluxo-lab-downloads, fluxo-lab-importacoes e fluxo-lab-stl.
- Workers AI: binding AI.

## Antes de distribuir alterações nativas

1. Validar login e navegação no Windows e Android reais.
2. Testar upload/download de STL/ZIP, relatórios, logout e persistência de sessão.
3. Confirmar que os clientes continuam apontando para https://app.markfree.com.br/.
4. Reconstruir EXE/APK somente quando código nativo mudar.

## Proibido

Não inserir credenciais, cookies, tokens, keystore, dados reais de pacientes ou exports D1 no repositório. Não usar o repositório como backup único dos dados do laboratório. Migrações D1, SQL em produção e operações destrutivas R2 não são executadas pelo pipeline.