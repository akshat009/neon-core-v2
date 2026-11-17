# Neon Core — Android app (Capacitor + AdMob)

This folder turns the game in `../web/game` into an Android app (the `/play` landing page isn't included). **Don't edit the game here** — edit `../web/game`, then sync.

```
android-app/
  package.json            Capacitor 8 + @capacitor-community/admob 8
  capacitor.config.json   app id, name, webDir = www
  scripts/sync-web.mjs    copies ../web/game → www/ and adds Capacitor's script
  android/                native Android Studio project (generated, committed)
  www/                    copy of ../web/game (git-ignored, recreated on every sync)
```

Inside the app the game detects it's running natively and uses **AdMob** (`web/game/features/ads/ads-admob.js`). On the website the same code uses AdSense or demo ads.

## Requirements

- Node 22+ and npm (Capacitor CLI 8 needs it)
- Android Studio (with an Android SDK, API 36) and JDK 21

## Build & run

```bash
cd android-app
npm install
npm run sync          # copy ../web/game into the app (debug: Google test ads) + update native plugins
npm run open          # opens Android Studio → Run ▶ on a phone or emulator
```

Run `npm run sync` again after every change in `../web/game`. CI builds a debug APK on every PR (`.github/workflows/android-build.yml`); download it from the run's artifacts (a zip).

**Latest APK for the phone:** every push to `main` also puts the debug APK (Google test ads) on the `apk-latest` pre-release as a plain `.apk`. Open this link on the phone to download and install it:
https://github.com/akshat009/neon-core-v2/releases/download/apk-latest/neon-core-debug.apk

## What the app shell does

- **Fullscreen:** status and navigation bars are hidden (immersive sticky, `MainActivity.java`); a swipe shows them briefly. They are hidden again when the game gets focus back after an ad. The game may draw under the notch; the HUD keeps clear of it with `env(safe-area-inset-*)`.
- **Portrait and landscape**: follows the phone's auto-rotate setting (`fullUser` in `AndroidManifest.xml`). The activity is not restarted on rotation (`configChanges`), the game just resizes.
- **Back button** (`@capacitor/app`, `../web/game/features/android.js`): pauses during play, resumes from the pause menu, closes sheets, goes back from the sector map, exits from the title screen. It does nothing during an ad, the shield offer or the end-of-sector screens.
- **Icon & splash:** sources in `assets/` (SVG sources in `assets/src/`). Regenerate with
  `npx capacitor-assets generate --android --iconBackgroundColor '#0a0820' --splashBackgroundColor '#03060d'`.

## AdMob

Debug builds always use Google's **test** IDs, so it's safe to tap.

1. In the AdMob console create the app and three ad units: **Rewarded**, **Interstitial**, **Banner**.
2. Unit IDs (`ca-app-pub-…/…`) → `../web/game/features/ads/ads-config.js` → `admob.live`.
3. App ID (`ca-app-pub-…~…`) → `android/release.properties` → `NEON_ADMOB_APP_ID` (see below).
4. Build the release with `npm run build:release` (or `npm run sync:release`, then build in Android Studio). Only release builds switch to the live IDs; if a live ID is empty, it falls back to test ads.

Never tap your own live ads. Add your phone as a test device in AdMob.

The app asks for ad consent automatically where the law requires it (EEA/UK) using Google's consent form; set up the consent message in AdMob → Privacy & messaging.

## Release build (Google Play)

1. Create an upload keystore once (Android Studio → Build → Generate Signed App Bundle → Create new), and **back it up**. Without it you can't ship updates.
2. Copy `android/release.properties.example` to `android/release.properties` (git-ignored) and fill in the keystore path, passwords and `NEON_ADMOB_APP_ID`.
3. Bump `versionCode` in `android/app/build.gradle` for every upload.
4. `npm run build:release` → `android/app/build/outputs/bundle/release/app-release.aab`.

Before publishing:
- **App ID:** `com.akshat009.neoncore` can't change after the first upload.
- **Privacy policy URL** (required because of ads) and the **Data safety** form in Play Console.
- **Target audience:** don't pick children under 13 unless you follow the Families policy for ads.
- **Backups:** `android:allowBackup="true"` stays on so shields, progress and Data come back after a reinstall (Android Auto Backup).
