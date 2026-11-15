FLUXO LAB ANDROID — APK DE PRODUÇÃO

Projeto Android em Java + WebView.
URL: https://fluxo-lab.trainingmav.workers.dev/

Requisitos: Android Studio recente, JDK 17, Android SDK Platform 36, Build Tools 36.0.0 e Gradle 8.13.

Abra esta pasta no Android Studio e sincronize o Gradle. Depois use Build > Build Bundle(s) / APK(s) > Build APK(s). O GitHub Actions também compila o APK debug.

Recursos: JavaScript, DOM Storage, cookies, navegação limitada à homologação/Cloudflare Access, links externos em outros aplicativos, seletor de arquivos e downloads com cookie da sessão.

A versão release é assinada com a keystore permanente do projeto. As próximas versões devem reutilizar exatamente a mesma keystore, alias e senhas, sempre aumentando versionCode. A chave privada nunca deve ser enviada ao repositório. O aplicativo exige internet.
