# ⚡ Neon Core - 3D Cyberpunk Arcade Runner

[![GitHub Pages](https://img.shields.io/badge/Play%20Online-GitHub%20Pages-00ffff?style=for-the-badge&logo=github)](https://akshat009.github.io/neon-core-v2/)
[![Three.js](https://img.shields.io/badge/Three.js-r128-black?style=for-the-badge&logo=three.js)](https://threejs.org/)
[![License](https://img.shields.io/badge/License-MIT-magenta?style=for-the-badge)](LICENSE)

**Neon Core** is a fast-paced 3D cyber-runner built with Three.js. Pilot a glowing plasma core through dangerous neon sectors, collect cyan data fragments, dodge fatal red laser mines, and activate dynamic chassis power-ups across Easy, Medium, and Hard difficulties!

🎮 **[Play Live in Browser](https://akshat009.github.io/neon-core-v2/)**

---

## 🕹️ Controls

### PC / Desktop
* **W / Up Arrow**: Move Forward
* **S / Down Arrow**: Move Backward / Brake
* **A / Left Arrow**: Steer Left
* **D / Right Arrow**: Steer Right
* **Spacebar**: Jump over gaps and laser barriers

### Mobile / Touch
* **Virtual Joystick (left)**: Analog steer & move
* **JUMP Button (right)**: Jump — works together with the joystick (multi-touch)
* **SHIELD Button**: Shows your shields; at 0, tap to watch an ad for one more

---

## ⚙️ Features
* **Full 3D Procedural Neon Grid**: Three.js WebGL renderer with bloom glow, particle trails and shatter effects.
* **Auto Quality**: Glow switches itself off on slow devices. Force it with `?quality=high` or `?quality=low` in the URL.
* **Responsive Orientation**: Auto-adapts FOV and controls for Desktop (16:9), Mobile Portrait (9:16), and Tablets.
* **Chassis Transformations**:
  * 🟩 **Micro Core (Green)**: Ultra-compact chassis with high speed.
  * 🟧 **Heavy Core (Orange)**: Heavyweight chassis with massive jump strength.
* **Dynamic Star Rating & Scoring**: Par-time scoring and star rating across 3 difficulty tiers.
* **Shields, Lives & Saved Runs**: 2 free shields a day, 3 lives per run, continue where you left off. Rewarded and banner ad placements (demo ads for now) — see [`web/features/README.md`](web/features/README.md).

---

## 📁 Project Structure

One game, two targets:

```
web/            The game (HTML/CSS/JS, no build step) — this is what the website serves
  index.html
  css/ js/      Core game: scene, effects, level, input, HUD, main loop
  features/     Shields, lives, saved runs, time freeze, ads (own README inside)
    ads/        AdMob (Android app) · AdSense H5 Games Ads (website) · demo ads
  vendor/       Three.js r128 + bloom add-ons + fonts, bundled so it works offline

android-app/    Capacitor 8 Android app with AdMob — copies web/ in at build time (own README)

index.html      Redirects the old link to web/
```

- **Website:** open `web/index.html`, or serve the repo with any static server.
- **Android:** see [`android-app/README.md`](android-app/README.md).
- **Ads:** see [`web/features/README.md`](web/features/README.md).

The scripts in `web/index.html` load in a fixed order and share globals, so keep that order.
