# Distribuição e segurança

## Artefatos
- Windows: instalador NSIS x64, sem assinatura de publicador.
- Android: APK debug de homologação, não destinado à Play Store.
- Os dois clientes conectam-se à homologação e exigem internet.

## Antes de compartilhar com a equipe
1. Validar login interno e Cloudflare Access no Windows e Android reais.
2. Testar upload/download de STL/ZIP, relatórios, navegação, logout e persistência de sessão.
3. Definir a lista de funcionários autorizados no Cloudflare Access.
4. Confirmar que EXE/APK não acessam produção.
5. Para Android release, criar e guardar keystore fora do repositório.
6. Para Windows, considerar assinatura digital do publicador.

## Proibido
Não inserir credenciais, cookies, tokens, keystore, arquivos reais de pacientes ou exports D1 no repositório. Não usar o repositório como backup único dos dados do laboratório.
