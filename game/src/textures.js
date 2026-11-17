// Canvas-generated textures: building facades with lit windows, road asphalt with
// lane dashes, sidewalk slabs, sand and palm-leaf-free ground. No image files.
import * as THREE from 'three';
import { mulberry32, range } from './random.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Warm stucco facade with a grid of windows, some lit gold, some dark.
export function buildingTexture(seed, base) {
  const rng = mulberry32(seed);
  const cols = 4 + Math.floor(rng() * 4);
  const rows = 6 + Math.floor(rng() * 8);
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    // subtle vertical shading + grime near the bottom
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,255,255,0.10)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const cw = w / cols;
    const ch = h / rows;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = c * cw + cw * 0.22;
        const y = r * ch + ch * 0.2;
        const ww = cw * 0.56;
        const hh = ch * 0.58;
        const lit = rng();
        g.fillStyle = lit < 0.28 ? '#ffd98a' : lit < 0.4 ? '#9fd8e8' : '#20242c';
        g.fillRect(x, y, ww, hh);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(x, y, ww, 3);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x, y + hh - 2, ww, 2);
      }
    }
    // roofline band
    g.fillStyle = 'rgba(0,0,0,0.30)';
    g.fillRect(0, 0, w, 10);
  });
}

export function roadTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#3a3a40';
    g.fillRect(0, 0, w, h);
    // speckle
    for (let i = 0; i < 260; i += 1) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // centre dashes (texture repeats along the road)
    g.fillStyle = '#e8c85a';
    g.fillRect(w / 2 - 2, 8, 4, 44);
    g.fillRect(w / 2 - 2, 76, 4, 44);
    // edge lines
    g.fillStyle = 'rgba(232,232,232,0.55)';
    g.fillRect(4, 0, 2, h);
    g.fillRect(w - 6, 0, 2, h);
  });
}

export function sidewalkTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#9a938a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
    g.beginPath();
    g.moveTo(w / 2, 0);
    g.lineTo(w / 2, h);
    g.moveTo(0, h / 2);
    g.lineTo(w, h / 2);
    g.stroke();
    for (let i = 0; i < 120; i += 1) {
      g.fillStyle = 'rgba(0,0,0,0.06)';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

export function sandTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#e8cf9a';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i += 1) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(190,150,90,0.35)' : 'rgba(255,240,200,0.4)';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 1);
    }
  });
}

export function grassTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#5d8a4a';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i += 1) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(40,90,30,0.4)' : 'rgba(140,190,90,0.35)';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 3);
    }
  });
}

export function roofTexture(seed, color) {
  const rng = mulberry32(seed);
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.15)';
    for (let i = 0; i < 8; i += 1) g.fillRect(0, i * 8, w, 2);
    void rng;
  });
}
