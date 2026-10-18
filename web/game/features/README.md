# Neon Core — Features & Monetization

Everything for shields, lives, ads and run progress lives in this folder. The core game (`js/`) only calls a few hooks, so this folder can change without touching gameplay code.

| File | What it does |
|---|---|
| `config.js` | All tunable numbers (free shields, lives, timers, ad length) |
| `storage.js` | Saved data in `localStorage` (shields, daily reset, saved run, best sector) |
| `pause.js` | Time freeze — used by ads, popups, respawns and when the app goes to the background |
| `ads/ads-config.js` | **Ad IDs for both platforms — the only file to edit when going live** |
| `ads/ads.js` | Ads adapter: picks AdMob (Android app), AdSense (website) or demo ads |
| `ads/ads-admob.js` | Android app: AdMob via the Capacitor plugin |
| `ads/ads-applixir.js` | Website: AppLixir rewarded video (no AdSense needed) |
| `ads/ads-web.js` | Website: AdSense H5 Games Ads (Ad Placement API) |
| `ads/ads-demo.js` | Demo ads used until real IDs are filled in |
| `shield.js` | Daily shields, auto-block, "no shields" popup, HUD shield button |
| `lives.js` | 3 lives per run, respawn, short protection after respawn |
| `run.js` | Start / continue / new run, sector saving, out-of-lives and restart screens |
| `features.css` | Styles for all of the above |

## Features

### Shield
- **2 free shields every day** (reset at local midnight). Shields earned from ads are kept on top.
- Hitting a red hurdle with a shield: the shield is used **automatically**, the hurdle breaks, the run continues (1 s grace so a cluster can't chain-hit).
- Hitting a hurdle with **0 shields**: the game **freezes** and shows *"No shields left — watch ad, +1 shield"*.
  - Watch to the end → shield is used on that hurdle, run continues.
  - Close the ad early → no reward, popup comes back.
  - Skip, or wait 6 s → lose 1 life.
- **HUD shield button** shows the count. At 0 it shows **AD**; tap any time to watch an ad for +1 shield (game frozen during the ad).
- Shields only stop hurdles. Falling off the track always costs a life.

### Lives
- **3 lives per run**, carried across sectors.
- Hurdle hit (no shield) → respawn on the spot. Fall → respawn on the last platform you stood on.
- 2 s of protection after a respawn (ball blinks).

### Out of lives
- *"Watch ad → +1 life & continue"* — continue right where you were, same sector, same data.
- *Skip* → **Run Reset** screen: *"You skipped the ad, so this run starts again from Sector 1"* with a **banner ad** at the bottom, kept away from the button.

### Saved progress
- The run (sector, difficulty, lives) is saved when a sector starts and when it's cleared.
- Start menu shows **CONTINUE · SECTOR N** and **NEW RUN** when a run is saved (also after closing the app).
- Skipping the continue ad clears the saved run.

### Start menu rewards
- Shows your shields and a **▶ AD · +1** button.

### Time freeze
- While any ad, popup or respawn is on screen — or the app is in the background — physics stop and the sector timer does not count, so star ratings stay fair.

## Monetization map

| Placement | Format | When | Reward |
|---|---|---|---|
| `shield` | Rewarded | Crash with 0 shields (popup) | +1 shield, used on that hurdle |
| `shield` | Rewarded | HUD shield button at 0, or start menu | +1 shield |
| `continue` | Rewarded | Out of lives | +1 life, continue on the spot |
| `restart` | Banner | Run Reset screen (AdMob / AdSense only) | — |

## Tuning

Edit `config.js`:

```js
dailyFreeShields: 2,
livesPerRun: 3,
respawnShieldSeconds: 2,
shieldGraceSeconds: 1,
respawnDelayMs: 700,
shieldOfferSeconds: 6,
maxAdContinuesPerRun: Infinity,   // e.g. 2 to allow only two ad continues per run
demoAdSeconds: 5
```

## Which ads run where

| Where the game runs | Ad network | Until IDs are filled in |
|---|---|---|
| Android app (`android-app/`, Capacitor) | **AdMob** (`ads/ads-admob.js`) | Google's test ads (test IDs are pre-filled) |
| Website on `asaxenadev.com/play` (game at `/play/game/`) | **AppLixir** rewarded video (`ads/ads-applixir.js`) | Demo ads |
| Website elsewhere with an AdSense ID | **AdSense H5 Games Ads** (`ads/ads-web.js`) | Demo ads |
| GitHub Pages / localhost | Demo ads | — |

The game picks automatically: inside the Capacitor app → AdMob; in a browser on an AppLixir-registered host → AppLixir; else AdSense if `adsenseClient` is set; otherwise demo.

### Going live — Android (AdMob)
See [`android-app/README.md`](../../../android-app/README.md). In short: AdMob app ID → `strings.xml`, ad unit IDs → `ads/ads-config.js`, set `testing: false`, `npm run sync`.

### Going live — Website (AppLixir, no AdSense needed)
1. Sign up at AppLixir as a publisher and add the site under **Sites** (`asaxenadev.com`, game at `https://asaxenadev.com/play/`). Copy its **API key**.
2. Put the key in `ads/ads-config.js` → `applixir.apiKey`, and keep the host in `applixir.allowedHosts`.
3. Add the **ads.txt** lines from the AppLixir dashboard to `https://asaxenadev.com/ads.txt` (Hostinger: `public_html/ads.txt` of the main domain).
4. Upload the contents of `web/` to `public_html/play/` (HTTPS): the landing page opens at `https://asaxenadev.com/play/` and the game at `https://asaxenadev.com/play/game/`. AppLixir doesn't serve on localhost or unregistered domains, so test on the real site.

Rewards are given only when AppLixir reports `complete`. AppLixir has no banner format, so the Run Reset screen shows no banner on this network.

### Going live — Website (AdSense H5 Games Ads)
1. Apply for H5 Games Ads in AdSense with the site that hosts the game.
2. Put your publisher ID (`ca-pub-…`) in `ads/ads-config.js` → `web.adsenseClient` (keep `testing: true` while you check it).
3. Optional banner on the Run Reset screen: create a 320×50 display ad unit and put its slot ID in `web.bannerSlot`.

H5 Games Ads only offers rewarded/interstitial in games, so the game asks for a rewarded ad as soon as an offer appears and opens it the moment the player taps "Watch ad". If no ad is available, the player sees "Ad not available right now".

Nothing else in the game changes — every screen calls `Ads.prepareRewarded()` / `Ads.showRewarded()` / `Ads.showBanner()` / `Ads.hideBanner()`.

**Policy reminders:** rewarded ads are always opt-in here (the player taps "Watch ad"); keep the banner away from buttons; screens with a banner also show real content (score, best sector).

## Saved data

| Key | Contents |
|---|---|
| `neonCoreSave.v1` | `{ shields, shieldDay, run, bestSector }` — `run` is `{ sector, difficulty, lives }` or `null` |
| `neonCoreScore` | Lifetime score (TOTAL ARCHIVE) — unchanged |
