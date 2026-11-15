plugins {
    id("com.android.application")
}

android {
    namespace = "br.com.markfree.fluxolab"
    compileSdk = 36

    defaultConfig {
        applicationId = "br.com.markfree.fluxolab"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.1"
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".homolog"
            versionNameSuffix = "-homolog"
        }
        release {
            isMinifyEnabled = false
            // A assinatura release será configurada externamente com keystore privada.
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
