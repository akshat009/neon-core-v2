// Copies the game from ../web/game into ./www (the folder Capacitor packs into the app)
// and adds Capacitor's script so the game can talk to native plugins (AdMob).
// Run via `npm run sync` — never edit files inside www/ directly.
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
writeFileSync(indexPath, html.replace(marker, '<script src="vendor/capacitor.js"></script>\n' + marker));
console.log('Copied ../web/game → www (with vendor/capacitor.js)');
