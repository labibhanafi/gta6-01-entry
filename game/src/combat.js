// Combat: hitscan shooting with spread + pellets, melee fists, damage to peds,
// cops and mission guards, explosions when a car hits 0 HP, hitmarkers.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { clamp } from './random.js';

export class Combat {
  constructor() {
    this.cooldown = 0;
    this.reloading = 0;
    this.hitmarkT = 0;
    this.lastShotAt = -10;
  }

  weaponDef(state) {
    return WEAPONS[state.weapon];
  }

  // Fire from the player's position toward the camera aim. targets: [{x,z,y,hp,alive,onHit}]
  tryFire(W, targets) {
    const { state, player, fx, audio } = W;
    if (this.cooldown > 0 || this.reloading > 0 || state.over) return false;
    const def = this.weaponDef(state);
    if (def.mag !== Infinity) {
      if (state.mag[state.weapon] <= 0) {
        this.startReload(W);
        return false;
      }
    }
    this.cooldown = 1 / def.rate;
    this.lastShotAt = W.time;
    if (def.mag !== Infinity) state.mag[state.weapon] -= 1;

    const ox = player.pos.x;
    const oy = player.pos.y + 1.45;
    const oz = player.pos.z;
    const yaw = player.yaw;
    const pitch = player.pitch || 0;
    // muzzle world position
    const mx = ox + Math.sin(yaw) * 0.7;
    const mz = oz + Math.cos(yaw) * 0.7;
    if (fx) fx.muzzle(mx, oy, mz, yaw);
    if (audio) audio.shoot(state.weapon);

    const pellets = def.pellets || 1;
    let anyHit = false;
    for (let p = 0; p < pellets; p += 1) {
      const spread = def.spread * (Math.random() * 2 - 1);
      const spreadV = def.spread * 0.7 * (Math.random() * 2 - 1);
      const ay = yaw + spread;
      const ap = pitch + spreadV;
      const dx = Math.sin(ay) * Math.cos(ap);
      const dy = Math.sin(ap);
      const dz = Math.cos(ay) * Math.cos(ap);
      // nearest target along the ray (cylinder test, radius 0.9, height 0..2)
      let best = null;
      let bestT = def.range;
      for (const t of targets) {
        if (!t.alive || t.hp <= 0) continue;
        const rx = t.x - ox;
        const rz = t.z - oz;
        const along = rx * dx + rz * dz;
        if (along < 0 || along > bestT) continue;
        const px = ox + dx * along - t.x;
        const pz = oz + dz * along - t.z;
        const perp = Math.hypot(px, pz);
        if (perp < 1.0) {
          best = t;
          bestT = along;
        }
      }
      if (best) {
        anyHit = true;
        best.hp -= def.damage;
        if (fx) fx.burst(best.x, 1.2, best.z, 6, 0xff4444, 3);
        if (best.hp <= 0 && best.alive) {
          best.alive = false;
          if (best.mesh) {
            best.mesh.rotation.x = Math.PI / 2;
            best.mesh.position.y = 0.3;
          }
          state.kills += 1;
          if (best.isCop) addWantedSafe(W, 1);
          if (best.onDeath) best.onDeath(W);
          if (W.onKill) W.onKill(best);
        }
      }
    }
    if (anyHit) {
      this.hitmarkT = 0.35;
      player.kick = def.kick;
    }
    // cars in the line of fire take damage too
    if (W.vehicles) {
      for (const v of W.vehicles) {
        if (v.dead || v === player.vehicle) continue;
        const dx = v.x - ox;
        const dz = v.z - oz;
        const along = dx * Math.sin(yaw) + dz * Math.cos(yaw);
        if (along < 0 || along > def.range) continue;
        const perp = Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw));
        if (perp < 1.4) {
          v.hp -= def.damage * 0.5;
          if (fx) fx.burst(v.x, 1, v.z, 4, 0xffcc55, 2);
          if (v.hp <= 0) explodeVehicle(W, v);
        }
      }
    }
    return true;
  }

  melee(W, targets) {
    const { state, player, fx, audio } = W;
    if (this.cooldown > 0) return;
    this.cooldown = 1 / 2.2;
    if (audio) audio.punch();
    const ox = player.pos.x;
    const oz = player.pos.z;
    const yaw = player.yaw;
    for (const t of targets) {
      if (!t.alive) continue;
      const dx = t.x - ox;
      const dz = t.z - oz;
      const dist = Math.hypot(dx, dz);
      const ahead = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / (dist || 1);
      if (dist < 2.4 && ahead > 0.3) {
        t.hp -= 12;
        if (fx) fx.burst(t.x, 1.2, t.z, 5, 0xffcc55, 2);
        if (t.hp <= 0) {
          t.alive = false;
          if (t.mesh) { t.mesh.rotation.x = Math.PI / 2; t.mesh.position.y = 0.3; }
          state.kills += 1;
          if (t.isCop) addWantedSafe(W, 1);
          if (W.onKill) W.onKill(t);
        }
      }
    }
  }

  startReload(W) {
    const { state, audio } = W;
    const def = this.weaponDef(state);
    if (def.mag === Infinity || this.reloading > 0) return;
    if (state.ammo[state.weapon] <= 0) return;
    this.reloading = 1.1;
    if (audio) audio.reload();
  }

  finishReload(W) {
    const { state } = W;
    const def = this.weaponDef(state);
    const need = def.mag - state.mag[state.weapon];
    const take = Math.min(need, state.ammo[state.weapon]);
    state.mag[state.weapon] += take;
    state.ammo[state.weapon] -= take;
  }

  update(dt, W) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hitmarkT = Math.max(0, this.hitmarkT - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) this.finishReload(W);
    }
  }
}

function addWantedSafe(W, n) {
  if (W.addWanted) W.addWanted(n);
}

export function explodeVehicle(W, v) {
  if (v.dead) return;
  v.dead = true;
  if (W.fx) W.fx.explosion(v.x, 0.8, v.z);
  if (W.audio) W.audio.explosion();
  if (W.scene) W.scene.remove(v.mesh);
  // splash damage to nearby peds/cops
  const all = [...(W.peds || []), ...(W.police ? W.police.cops : [])];
  for (const t of all) {
    if (!t.alive) continue;
    const d = Math.hypot(t.x - v.x, t.z - v.z);
    if (d < 7) {
      t.hp -= 120;
      if (t.hp <= 0) {
        t.alive = false;
        if (t.mesh) { t.mesh.rotation.x = Math.PI / 2; t.mesh.position.y = 0.3; }
      }
    }
  }
}
