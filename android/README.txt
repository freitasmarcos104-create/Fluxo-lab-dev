FLUXO LAB ANDROID — APK OFICIAL

Aplicativo Android em Java + WebView conectado ao sistema central.
URL oficial: https://app.markfree.com.br/

Requisitos: JDK 17, Android SDK Platform 36, Build Tools 36.0.0 e Gradle 8.13.

O aplicativo acessa a mesma versão de produção usada no navegador e no Windows. Atualizações de telas, regras, emblemas e dados são feitas no servidor central; não é necessário reconstruir o APK para cada atualização do sistema.

Recursos: JavaScript, DOM Storage, cookies, navegação limitada ao domínio oficial, links externos em outros aplicativos, seletor de arquivos e downloads com cookie da sessão.

A versão release reutiliza a keystore permanente do projeto, sem alterar o applicationId. As próximas versões devem manter exatamente a mesma keystore, alias e senhas, sempre aumentando versionCode. A chave privada nunca deve ser enviada ao repositório. O aplicativo exige internet.
