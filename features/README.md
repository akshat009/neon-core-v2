# Neon Core — Features & Monetization

Everything for shields, lives, ads and run progress lives in this folder. The core game (`js/`) only calls a few hooks, so this folder can change without touching gameplay code.

| File | What it does |
|---|---|
| `config.js` | All tunable numbers (free shields, lives, timers, ad length) |
| `storage.js` | Saved data in `localStorage` (shields, daily reset, saved run, best sector) |
| `pause.js` | Time freeze — used by ads, popups, respawns and when the app goes to the background |
| `ads.js` | Ads adapter. Demo ads today; AdMob plugs in here |
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
| `restart` | Banner | Run Reset screen | — |

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

## Going live with AdMob (Android)

1. Wrap the game in an Android app (Capacitor or Cordova) and add an AdMob plugin (for example `@capacitor-community/admob` for Capacitor).
2. In `ads.js`, set `ADS_CONFIG.mode = 'admob'` and fill `appId`, `rewardedId`, `bannerId` from your AdMob account.
3. Fill the three functions in `ads.js`:
   - `admobShowRewarded(placement)` → show a rewarded ad; **return `true` only when the plugin reports the reward was earned**.
   - `admobShowBanner(placement)` → show a bottom banner.
   - `admobHideBanner()` → hide it.
4. Use Google's **test ad unit IDs** while developing, and never tap your own live ads.

Nothing else in the game changes — every screen already calls `Ads.showRewarded()` / `Ads.showBanner()` / `Ads.hideBanner()`.

**Policy reminders:** rewarded ads are always opt-in here (the player taps "Watch ad"); keep the banner away from buttons; screens with a banner also show real content (score, best sector).

## Saved data

| Key | Contents |
|---|---|
| `neonCoreSave.v1` | `{ shields, shieldDay, run, bestSector }` — `run` is `{ sector, difficulty, lives }` or `null` |
| `neonCoreScore` | Lifetime score (TOTAL ARCHIVE) — unchanged |
