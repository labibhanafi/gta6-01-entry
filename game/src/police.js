// Wanted level (0-5 stars) + police: cruisers that chase and ram, foot cops
// that shoot on foot, bust when they get close, decay when unseen and far.
import * as THREE from 'three';
import { MAX_WANTED, WANTED_DECAY_S } from './config.js';
import { clamp } from './random.js';
import { createVehicle, collideCircle } from './vehicles.js';

export function addWanted(state, n, fx, audio) {
  const before = state.wanted;
  state.wanted = clamp(state.wanted + n, 0, MAX_WANTED);
  if (state.wanted > before && audio) audio.siren(state.wanted > 0);
  return state.wanted;
}

// Foot cop: box person in navy with a pistol.
function makeCopMesh(scene) {
  const g = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1c2f4a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.34), navy);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
  head.position.y = 1.62;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.4), new THREE.MeshLambertMaterial({ color: 0x0f1c2e }));
  cap.position.y = 1.82;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), navy);
  legL.position.set(-0.14, 0.31, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(body, head, cap, legL, legR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  scene.add(g);
  return g;
}

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.cruisers = []; // vehicles with driver 'cop'
    this.cops = [];     // {mesh, x, z, yaw, hp, alive, shootT, walkPhase}
    this.unseenT = 0;
    this.spawnT = 0;
    this.bustT = 0;
  }

  wantedCount(state) {
    return state.wanted;
  }

  // Desired cruiser count for a wanted level.
  targetCruisers(wanted) {
    return wanted === 0 ? 0 : Math.min(4, wanted);
  }

  spawnCruiser(x, z) {
    const v = createVehicle(this.scene, 'cruiser', x, z, 0, { driver: 'cop' });
    v.speed = 0;
    this.cruisers.push(v);
    return v;
  }

  spawnFootCop(x, z) {
    const mesh = makeCopMesh(this.scene);
    mesh.position.set(x, 0, z);
    const c = { mesh, x, z, yaw: 0, hp: 100, alive: true, shootT: 1 + Math.random(), walkPhase: 0 };
    this.cops.push(c);
    return c;
  }

  clear() {
    for (const v of this.cruisers) this.scene.remove(v.mesh);
    for (const c of this.cops) this.scene.remove(c.mesh);
    this.cruisers = [];
    this.cops = [];
    this.unseenT = 0;
    this.bustT = 0;
  }

  update(dt, W) {
    const { state, player, fx, audio } = W;
    const wanted = state.wanted;
    const px = player.pos.x;
    const pz = player.pos.z;

    // --- spawn / despawn cruisers to match wanted level ---
    this.spawnT -= dt;
    const want = this.targetCruisers(wanted);
    if (this.cruisers.length < want && this.spawnT <= 0) {
      this.spawnT = 1.2;
      const a = Math.random() * Math.PI * 2;
      const sx = clamp(px + Math.cos(a) * 70, -280, 280);
      const sz = clamp(pz + Math.sin(a) * 70, -280, 230);
      this.spawnCruiser(sx, sz);
    }
    // foot cops appear at 2+ stars, up to 3, near the player
    if (wanted >= 2 && this.cops.filter((c) => c.alive).length < 3 && this.spawnT <= -0.5) {
      const a = Math.random() * Math.PI * 2;
      this.spawnFootCop(clamp(px + Math.cos(a) * 18, -280, 280), clamp(pz + Math.sin(a) * 18, -280, 230));
    }

    // --- cruiser pursuit: steer toward the player, ram, flash lights ---
    const now = W.time;
    for (const v of this.cruisers) {
      if (v.dead) continue;
      const dx = px - v.x;
      const dz = pz - v.z;
      const dist = Math.hypot(dx, dz);
      const targetYaw = Math.atan2(dx, dz);
      let dy = targetYaw - v.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      v.yaw += clamp(dy, -2.2 * dt, 2.2 * dt);
      const speedTarget = dist > 8 ? 40 : 26;
      v.speed += (speedTarget - v.speed) * Math.min(1, dt * 0.9);
      const nx = v.x + Math.sin(v.yaw) * v.speed * dt;
      const nz = v.z + Math.cos(v.yaw) * v.speed * dt;
      const res = collideCircle(W.city.colliders, nx, nz, 1.6);
      v.x = clamp(res.x, -295, 295);
      v.z = clamp(res.z, -295, 330);
      if (res.hit) v.speed *= 0.4;
      // ram the player's car / body
      if (dist < 3.2) {
        if (player.vehicle && player.vehicle !== v) {
          player.vehicle.hp -= 14 * dt * 10 * 0.1 + 2 * dt;
          v.speed *= 0.85;
          if (fx) fx.burst(px, 0.9, pz, 3, 0xffcc55, 2);
        } else if (!player.vehicle) {
          state.hp -= 22 * dt;
          if (fx) fx.burst(px, 1, pz, 3, 0xff5555, 2);
        }
        // bust: cop touches the player on foot at low speed
        if (!player.vehicle && dist < 1.6) {
          this.bustT += dt;
          if (this.bustT > 1.2) W.onBusted();
        } else {
          this.bustT = Math.max(0, this.bustT - dt);
        }
      }
      // exploding cruiser
      if (v.hp <= 0 && !v.dead) {
        v.dead = true;
        if (fx) fx.explosion(v.x, 0.8, v.z);
        if (audio) audio.explosion();
        this.scene.remove(v.mesh);
      }
      if (!v.dead) {
        v.mesh.position.set(v.x, 0, v.z);
        v.mesh.rotation.y = v.yaw;
        if (v.light) v.light.material.color.setHex(Math.floor(now * 6) % 2 === 0 ? 0xff2222 : 0x2266ff);
      }
    }
    this.cruisers = this.cruisers.filter((v) => !v.dead);

    // --- foot cops: run at the player, shoot when in range ---
    for (const c of this.cops) {
      if (!c.alive) continue;
      const dx = px - c.x;
      const dz = pz - c.z;
      const dist = Math.hypot(dx, dz);
      c.yaw = Math.atan2(dx, dz);
      if (dist > 14) {
        c.x += Math.sin(c.yaw) * 5.2 * dt;
        c.z += Math.cos(c.yaw) * 5.2 * dt;
        c.walkPhase += dt * 9;
      } else {
        c.shootT -= dt;
        if (c.shootT <= 0 && !player.vehicle) {
          c.shootT = 0.9 + Math.random() * 0.7;
          // cop shot: chance to hit, scaled by distance
          if (Math.random() < clamp(0.5 - dist * 0.012, 0.1, 0.5)) {
            state.hp -= 7;
            if (fx) fx.burst(px, 1.2, pz, 4, 0xff5555, 2);
            if (audio) audio.shoot('pistol');
          }
          if (fx) fx.muzzle(c.x + Math.sin(c.yaw), 1.3, c.z + Math.cos(c.yaw), c.yaw);
        }
      }
      const swing = Math.sin(c.walkPhase) * 0.45;
      c.mesh.userData.legL.rotation.x = swing;
      c.mesh.userData.legR.rotation.x = -swing;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.yaw;
    }

    // --- wanted decay: unseen (no cop within 40 m) and far from cruisers ---
    const nearestCop = Math.min(
      ...this.cruisers.map((v) => Math.hypot(v.x - px, v.z - pz)),
      ...this.cops.filter((c) => c.alive).map((c) => Math.hypot(c.x - px, c.z - pz)),
      Infinity,
    );
    if (wanted > 0 && nearestCop > 45) {
      this.unseenT += dt;
      if (this.unseenT > WANTED_DECAY_S) {
        this.unseenT = 0;
        state.wanted = Math.max(0, state.wanted - 1);
        if (audio) audio.siren(state.wanted > 0);
      }
    } else {
      this.unseenT = 0;
    }
    if (audio && this.ctx !== false) audio.siren(wanted > 0);
  }
}
