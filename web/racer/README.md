# Neon Core: Racer (prototype)

Milestone 1 of the cyberpunk racer: a separate page so it can be played on a phone
(`play.asaxenadev.com/racer/`) without touching the ball game in `../game/`.

- **Highway** (`js/track.js`): one path built from pieces — straight, zigzag, long bends and
  elevated skyways on pillars. Everything is placed by distance `s` and sideways offset `d`.
- **Cities** (`js/city.js`): Neon City, Neo-Delhi (India Gate), Neo-Lucknow (Rumi Darwaza),
  Neo-Hyderabad (Charminar), Neo-Jaipur (Hawa Mahal), Neo-Chennai (gopuram). Instanced towers
  with shader windows, neon signs in English / Hindi / Telugu / Tamil, holograms, flying
  traffic, rain; the wet-road reflections are faked in the road shader.
- **Race** (`js/race.js`): you vs three rivals, hold GAS to speed up (coast when you let go), steer + brake, slipstream
  (+8% close behind someone), shock-punch (3 hits = takedown), rivals punch back.
- **Bike** (`js/bike.js`): light-bike built from primitives, no model files.

Controls: touch — steer pad, hold GAS, PUNCH, BRAKE · keyboard — W/↑ gas, A/D steer, S brake, Space or J punch.
`?quality=low` turns off bloom and lowers resolution.

Not yet: fuel, stunts, cars, SHOP, saving, ads, music — later milestones.
