plugins {
    id("com.android.application")
}

android {
    signingConfigs {
        create("release") {
            storeFile = file(System.getenv("ANDROID_KEYSTORE_PATH") ?: "${buildDir}/missing-release-key.p12")
            storeType = "PKCS12"
            storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: ""
            keyAlias = System.getenv("ANDROID_KEY_ALIAS") ?: ""
            keyPassword = System.getenv("ANDROID_KEY_PASSWORD") ?: ""
        }
    }

    namespace = "br.com.markfree.fluxolab"
    compileSdk = 36

    defaultConfig {
        applicationId = "br.com.markfree.fluxolab"
        minSdk = 26
        targetSdk = 36
        versionCode = 3
        versionName = "0.1.3"
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".homolog"
            versionNameSuffix = "-homolog"
        }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
