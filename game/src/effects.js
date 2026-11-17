// Particles, muzzle flash, smoke, skid marks and screen shake. One pooled
// THREE.Points cloud plus a few transient meshes, reused every frame.
import * as THREE from 'three';
import { mulberry32 } from './random.js';

const MAX_P = 900;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.pos = new Float32Array(MAX_P * 3);
    this.col = new Float32Array(MAX_P * 3);
    this.vel = new Float32Array(MAX_P * 3);
    this.life = new Float32Array(MAX_P);
    this.maxLife = new Float32Array(MAX_P);
    this.head = 0;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.55, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < MAX_P; i += 1) this.pos[i * 3 + 1] = -100;
    this.shake = 0;
    this.shakeT = 0;
    this.rng = mulberry32(4242);
    // muzzle flash: a small additive sprite quad, repositioned per shot
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffd76a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    });
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), flashMat);
    this.flash.visible = false;
    scene.add(this.flash);
    this.flashT = 0;
  }

  _spawn(x, y, z, vx, vy, vz, life, r, g, b) {
    const i = this.head;
    this.head = (this.head + 1) % MAX_P;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.col[i * 3] = r;
    this.col[i * 3 + 1] = g;
    this.col[i * 3 + 2] = b;
  }

  burst(x, y, z, n, color, speed, up = 1) {
    const r = ((color >> 16) & 255) / 255;
    const g = ((color >> 8) & 255) / 255;
    const b = (color & 255) / 255;
    for (let i = 0; i < n; i += 1) {
      const a = this.rng() * Math.PI * 2;
      const s = speed * (0.3 + this.rng() * 0.7);
      this._spawn(x, y, z, Math.cos(a) * s, this.rng() * up * speed, Math.sin(a) * s,
        0.4 + this.rng() * 0.5, r, g, b);
    }
  }

  smoke(x, y, z, n = 3) {
    for (let i = 0; i < n; i += 1) {
      this._spawn(x + (this.rng() - 0.5), y + this.rng() * 0.4, z + (this.rng() - 0.5),
        (this.rng() - 0.5) * 0.6, 0.8 + this.rng(), (this.rng() - 0.5) * 0.6,
        0.9 + this.rng() * 0.7, 0.32, 0.32, 0.34);
    }
  }

  explosion(x, y, z) {
    this.burst(x, y + 0.5, z, 60, 0xff7a1a, 9, 1.6);
    this.burst(x, y + 0.5, z, 30, 0xffd76a, 6, 2);
    this.smoke(x, y + 1, z, 14);
    this.addShake(0.9);
  }

  muzzle(x, y, z, yaw) {
    this.flash.position.set(x, y, z);
    this.flash.rotation.y = yaw;
    this.flash.material.opacity = 0.95;
    this.flash.visible = true;
    this.flashT = 0.06;
    this.burst(x, y, z, 5, 0xffd76a, 4, 0.5);
  }

  skid(x, y, z) {
    this._spawn(x, y, z, 0, 0.2, 0, 0.5, 0.12, 0.12, 0.13);
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  update(dt) {
    for (let i = 0; i < MAX_P; i += 1) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -100;
        continue;
      }
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] -= 2.5 * dt;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flash.visible = false;
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.8);
  }

  // Small random offset applied to the camera while shaking.
  shakeOffset() {
    if (this.shake <= 0.01) return { x: 0, y: 0 };
    const s = this.shake * 0.35;
    return { x: (this.rng() - 0.5) * s, y: (this.rng() - 0.5) * s };
  }
}
