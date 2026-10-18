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
* **Shields, Lives & Saved Runs**: 2 free shields a day, 3 lives per run, continue where you left off. Rewarded and banner ad placements (demo ads for now) — see [`features/README.md`](features/README.md).

---

## 📁 Project Structure

Plain HTML, CSS and JavaScript — no build step. Open `index.html` in a browser, or serve the folder with any static server.

```
index.html        Markup only (menus, HUD, touch controls)
css/style.css     All styles
js/config.js      Difficulty settings, saved score
js/audio.js       Synth sound effects, mute
js/scene.js       Three.js scene, camera, lights, look of the track, pickups, hurdles and ball
js/effects.js     Particles, bloom glow, camera shake, per-frame visual effects
js/level.js       Game state, level generation, ball power-ups
js/input.js       Keyboard and touch input
js/ui.js          HUD, menus, buttons, fullscreen
js/game.js        Main loop: physics (sub-stepped), collisions, win / lose

features/         Shields, lives, ads, run progress, time freeze (own README inside)
```

The scripts are loaded in the order above and share globals, so keep that order in `index.html`.
