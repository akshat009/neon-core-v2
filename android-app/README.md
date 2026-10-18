# Neon Core — Android app (Capacitor + AdMob)

This folder turns the game in `../web` into an Android app. **Don't edit the game here** — edit `../web`, then sync.

```
android-app/
  package.json            Capacitor 8 + @capacitor-community/admob 8
  capacitor.config.json   app id, name, webDir = www
  scripts/sync-web.mjs    copies ../web → www/ and adds Capacitor's script
  android/                native Android Studio project (generated, committed)
  www/                    copy of ../web (git-ignored, recreated on every sync)
```

Inside the app the game detects it's running natively and uses **AdMob** (`web/features/ads/ads-admob.js`). On the website the same code uses AdSense or demo ads.

## Requirements

- Node 20+ and npm
- Android Studio (with an Android SDK, API 36) and JDK 21

## Build & run

```bash
cd android-app
npm install
npm run sync        # copy ../web into the app + update native plugins
npm run open        # opens Android Studio → Run ▶ on a phone or emulator
```

Run `npm run sync` again after every change in `../web`.

## AdMob setup

Right now everything uses **Google's test IDs**, so you'll see test ads and can tap them safely.

1. Create the app in the AdMob console and two ad units: **Rewarded** and **Banner**.
2. App ID (`ca-app-pub-…~…`) → `android/app/src/main/res/values/strings.xml` → `admob_app_id`.
3. Ad unit IDs (`ca-app-pub-…/…`) → `../web/features/ads/ads-config.js` → `admob.rewardedId`, `admob.bannerId`, and set `testing: false`.
4. `npm run sync` and rebuild.

Never tap your own live ads — test on your phone with test ads (or add it as a test device in AdMob).

The app asks for ad consent automatically where the law requires it (EEA/UK) using Google's consent form; set up the consent message in AdMob → Privacy & messaging.

## Before publishing on Google Play

- **App ID:** `com.akshat009.neoncore` (in `capacitor.config.json` and `android/app/build.gradle`). It can't change after the first upload, so pick the final one now.
- **Privacy policy URL** (required because of ads) and the **Data safety** form in Play Console.
- **Target audience:** don't pick children under 13 unless you follow the Families policy for ads.
- App icon & splash: replace the defaults in `android/app/src/main/res/` (or use `@capacitor/assets`).
- Release build: Android Studio → Build → Generate Signed App Bundle (.aab).
