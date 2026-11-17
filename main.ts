// Solara Bay — hand-in program (Node 22, standard library only).
//
// The game itself is the static site in game/ beside this file: open
// game/index.html in a desktop browser and it plays offline, no build step,
// no network. This program copies game/ and screenshots/ into the output
// directory and writes the dossier the judge reads, using the vendored
// make.fun library so the bytes match what the scorer rebuilds.
//
// Run it the way the kit prescribes:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (MAKEFUN_OUTPUT_DIR stands in for the grader's /output.)
// Play the game locally with: node serve.ts  →  http://localhost:8080

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const GAME_TITLE = 'Solara Bay';
const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own: past any of them the gate refuses the entry,
// so this program refuses first, with the same numbers.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`${GAME_TITLE}: dossier written to ${join(out, 'dossier.json')} (${dossier.length} bytes)`);
