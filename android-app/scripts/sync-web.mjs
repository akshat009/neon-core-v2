// Copies the game from ../web/game into ./www (the folder Capacitor packs into the app)
// and adds Capacitor's script so the game can talk to native plugins (AdMob, App).
// Run via `npm run sync` (debug: test ads) or `npm run sync:release` (live AdMob ids,
// see web/game/features/ads/ads-config.js). Never edit files inside www/ directly.
const release = process.argv.includes('--release');
import { cpSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, '../web/game');
const out = resolve(root, 'www');
const capacitorJs = resolve(root, 'node_modules/@capacitor/core/dist/capacitor.js');

if (!existsSync(capacitorJs)) {
  console.error('Run `npm install` in android-app/ first.');
  process.exit(1);
}

// A release build must never ship with test ads: stop if the live ad units are still empty
if (release) {
  const adsConfig = readFileSync(resolve(src, 'features/ads/ads-config.js'), 'utf8');
  const live = /live:\s*\{([^}]*)\}/.exec(adsConfig);
  const missing = ['rewardedId', 'bannerId', 'interstitialId'].filter((k) => {
    const m = live && new RegExp(k + "\\s*:\\s*'([^']*)'").exec(live[1]);
    return !m || !/^ca-app-pub-\d+\/\d+$/.test(m[1]);
  });
  if (missing.length) {
    console.error(`Release build stopped: fill ADS_CONFIG.admob.live (${missing.join(', ')}) in web/game/features/ads/ads-config.js with your AdMob ad unit ids.`);
    process.exit(1);
  }
}

rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true });
cpSync(capacitorJs, resolve(out, 'vendor/capacitor.js'));

const indexPath = resolve(out, 'index.html');
const html = readFileSync(indexPath, 'utf8');
const marker = '<script src="vendor/three/three.min.js"></script>';
if (!html.includes(marker)) {
  console.error('Could not find the Three.js script tag in web/game/index.html.');
  process.exit(1);
}
const buildTag = `<script>window.NEON_BUILD = '${release ? 'release' : 'debug'}';</script>`;
writeFileSync(indexPath, html.replace(marker, buildTag + '\n<script src="vendor/capacitor.js"></script>\n' + marker));
console.log(`Copied ../web/game → www (with vendor/capacitor.js, ${release ? 'RELEASE: live AdMob ids' : 'debug: test ads'})`);
