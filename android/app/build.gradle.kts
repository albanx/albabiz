plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.zonetech.albabiz"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.zonetech.albabiz"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        // The Pages site the WebView loads, and the Worker API. The app can be
        // repointed at runtime via the Worker's /api/config (ui_base_override)
        // without a re-release — see MainActivity.
        buildConfigField("String", "UI_BASE", "\"https://albabiz.pages.dev/\"")
        buildConfigField("String", "API_BASE", "\"https://albabiz-api.albanx.workers.dev\"")
    }

    // -----------------------------------------------------------------------
    // Release signing — mirrors the zonetech-tv pattern. Never commit the
    // keystore or passwords; Gradle reads them from ~/.gradle/gradle.properties
    // (or env vars) at build time:
    //   AB_KEYSTORE_PATH=C:/projects/albabiz.ie/android/keystore/albabiz-upload.jks
    //   AB_KEYSTORE_PASSWORD=...
    //   AB_KEY_ALIAS=albabiz-upload
    //   AB_KEY_PASSWORD=...
    // Missing any of them -> release falls back to the debug key (fine for local
    // QA, NOT uploadable to Play).
    // -----------------------------------------------------------------------
    val ksPath = (project.findProperty("AB_KEYSTORE_PATH") as String?) ?: System.getenv("AB_KEYSTORE_PATH")
    val ksPass = (project.findProperty("AB_KEYSTORE_PASSWORD") as String?) ?: System.getenv("AB_KEYSTORE_PASSWORD")
    val keyAlias0 = (project.findProperty("AB_KEY_ALIAS") as String?) ?: System.getenv("AB_KEY_ALIAS")
    val keyPass = (project.findProperty("AB_KEY_PASSWORD") as String?) ?: System.getenv("AB_KEY_PASSWORD")
    val hasReleaseSigning = listOf(ksPath, ksPass, keyAlias0, keyPass).all { !it.isNullOrBlank() } &&
        ksPath?.let { file(it).exists() } == true

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(ksPath!!)
                storePassword = ksPass
                this.keyAlias = keyAlias0
                this.keyPassword = keyPass
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { buildConfig = true }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    // Native splash screen backport (Android 12 SplashScreen API on older OS).
    implementation("androidx.core:core-splashscreen:1.0.1")
}
