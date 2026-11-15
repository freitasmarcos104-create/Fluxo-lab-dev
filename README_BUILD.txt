FLUXO LAB — COMPILAÇÃO DOS APLICATIVOS (HOMOLOGAÇÃO)

COMPILAR NA NUVEM
1. Abra a aba Actions.
2. Selecione Build Fluxo Lab installers.
3. Clique em Run workflow.
4. Aguarde Windows e Android terminarem.
5. Baixe os artefatos:
   - fluxo-lab-windows-exe-homologacao
   - fluxo-lab-android-apk-homologacao

Os artefatos ficam disponíveis por 14 dias. O EXE é NSIS x64 sem assinatura. O APK é DEBUG.

BUILD WINDOWS LOCAL
Requisitos: Windows 10/11 x64, Node.js 22 e internet.
Na raiz, execute:
  powershell -ExecutionPolicy Bypass -File .\scripts\build-windows.ps1
Saída: desktop\dist\

BUILD ANDROID LOCAL
Requisitos: Android Studio, JDK 17, Android SDK Platform 36, Build Tools 36.0.0 e Gradle 8.13.
Abra android/ no Android Studio e gere o APK debug.
Saída: android\app\build\outputs\apk\debug\

IMPORTANTE
Os dois clientes acessam apenas a URL de homologação e precisam de internet. O APK debug não é para Play Store. Não há deploy automático de Worker nem operação D1/R2 neste repositório.
