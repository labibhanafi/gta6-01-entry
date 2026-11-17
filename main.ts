// SOLMAR's hand-in program (Node 22, standard library only).
//
// The game is the static site under game/ — index.html and its ES modules,
// three.js vendored under game/vendor/three, no build step, no network at
// all when it runs. This program packages the entry: it copies game/ and
// screenshots/ from beside this file into the output directory (/output in
// the grader, $MAKEFUN_OUTPUT_DIR anywhere else) and writes dossier.json
// there with the kit's vendored buildDossier, under the same caps the
// sealed scorer enforces. Run it twice and the bytes come out identical,
// because the dossier is built from the copied tree.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//   Serve it locally with: node serve.ts  (then http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps mirror reference/gate.json: at most 4 screenshots of 256 KiB
// each, at most 993 files and 48 MiB under game/, no game path over 1000
// bytes, and the dossier's source text held to 160 KiB.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

copyTree(join(repoRoot, 'game'), join(outputDir, 'game'));
if (existsSync(join(repoRoot, 'screenshots'))) {
  copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));
} else {
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outputDir, DOSSIER_CAPS);
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`solmar: wrote game/, screenshots/ and dossier.json (${dossier.length} bytes) to ${outputDir}`);
