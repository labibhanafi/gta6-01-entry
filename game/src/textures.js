// SOLMAR — canvas-generated textures. No image files, no network: every
// facade, road and sign is painted once at boot from the seeded RNG.
import * as THREE from 'three';
import { createRandom, range, pick } from './random.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function makeBuildingTextures(rng) {
  // Six facade variants: warm stucco, glass blue, terracotta, mint, rose, sand.
  const bases = ['#d8c9a8', '#b8c4d0', '#e0a878', '#9fb8a8', '#c98a8a', '#e8d8b0'];
  const textures = bases.map((base) => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // subtle vertical shading
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.18)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.06)'); grad.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // window grid, some lit gold (golden hour)
    const cols = 6, rows = 10;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 14 + c * 40, y = 12 + r * 24;
        const lit = rng() < 0.35;
        g.fillStyle = lit ? '#ffd98a' : (rng() < 0.5 ? '#2a3547' : '#3d5a78');
        g.fillRect(x, y, 26, 15);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(x, y, 26, 3);
      }
    }
    // ground-floor shopfront band
    g.fillStyle = 'rgba(20,16,10,0.85)'; g.fillRect(0, h - 26, w, 26);
    g.fillStyle = '#ffd75e'; g.font = 'bold 13px sans-serif';
    g.fillText(pick(rng, ['SOLMAR', 'CAFÉ', 'TACOS', 'SURF', 'HOTEL', 'MARKET']), 10, h - 8);
  }));
  return textures;
}

export function makeRoadTexture(horizontal) {
  const tex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3d4148'; g.fillRect(0, 0, w, h);
    // asphalt noise
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.04})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // centre dashed line — along the road's length (x for horizontal roads)
    g.fillStyle = '#e8c84a';
    if (horizontal) {
      for (let x = 0; x < w; x += 32) g.fillRect(x, h / 2 - 3, 18, 6);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(0, 6, w, 3); g.fillRect(0, h - 9, w, 3);
    } else {
      for (let y = 0; y < h; y += 32) g.fillRect(w / 2 - 3, y, 6, 18);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(6, 0, 3, h); g.fillRect(w - 9, 0, 3, h);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function makeSidewalkTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#9aa0a8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke();
      g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke();
    }
  });
}

export function makeSandTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e8c98a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1200; i++) {
      g.fillStyle = `rgba(120,80,20,${0.03 + Math.random() * 0.05})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

export function makeOceanTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2a8ab0'); grad.addColorStop(0.5, '#1e6f8e'); grad.addColorStop(1, '#155a78');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const y = Math.random() * h;
      g.beginPath();
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.08 + i) * 4);
      g.stroke();
    }
  });
}

export function makeSignTexture(text, bg, fg) {
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = fg; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 1);
  });
}

export function buildTextures(seed) {
  const rng = createRandom(seed ^ 0x5eed);
  return {
    buildings: makeBuildingTextures(rng),
    roadH: makeRoadTexture(true),
    roadV: makeRoadTexture(false),
    sidewalk: makeSidewalkTexture(),
    sand: makeSandTexture(),
    ocean: makeOceanTexture(),
    signGarage: makeSignTexture("MARLOW'S", '#1a2a44', '#ffd75e'),
    signBank: makeSignTexture('MERIDIAN BANK', '#274a2a', '#ffe9a8'),
    signCasino: makeSignTexture('THE PALMS', '#5a1a3a', '#ffd75e'),
    signDocks: makeSignTexture('SOLMAR DOCKS', '#123a4a', '#9fe8ff'),
    signPier: makeSignTexture('SUNSET PIER', '#7a4d00', '#fff2c8'),
  };
}
