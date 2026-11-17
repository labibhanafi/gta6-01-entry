// SOLMAR — combat: fists / pistol / SMG / shotgun, hit detection against
// guards, cops and peds, enemy return fire, explosions and damage to the player.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { clamp } from './random.js';

export function createCombat(scene, seed) {
  const enemies = [];   // {ped, hp, role, shootT, alive}
  let lastShotAt = -99;
  let fireCooldown = 0;

  function addEnemy(ped, hp, role) {
    const e = { ped, hp, maxHp: hp, role, shootT: 1 + Math.random(), alive: true };
    enemies.push(e);
    return e;
  }

  function explode(G, x, z, radius) {
    G.fx.spawnExplosion(x, z);
    G.audio.explosion();
    G.fx.shake(0.7);
    const s = G.state;
    const dPlayer = Math.hypot(s.player.x - x, s.player.z - z);
    if (dPlayer < radius * 2.2) damagePlayer(G, 45);
    for (const e of enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.ped.x - x, e.ped.z - z) < radius) killEnemy(G, e, 'explosion');
    }
    for (const car of G.vehicles.cars) {
      if (car.dead) continue;
      if (Math.hypot(car.x - x, car.z - z) < radius * 0.8) {
        car.hp -= 60;
        if (car.hp <= 0) { car.dead = true; G.fx.spawnExplosion(car.x, car.z); }
      }
    }
  }

  function damagePlayer(G, amount) {
    const s = G.state;
    if (s.screen !== 'play') return;
    let rest = amount;
    if (s.armor > 0) { const absorbed = Math.min(s.armor, rest * 0.6); s.armor -= absorbed; rest -= absorbed; }
    s.health -= rest;
    G.hud.flashVignette();
    if (s.health <= 0) {
      s.health = 0;
      G.missions.wasted(G, 'Mara is down. The bay keeps moving without her.');
    }
  }

  function killEnemy(G, e, cause) {
    e.alive = false; e.ped.alive = false; e.ped.mesh.visible = false;
    G.state.stats.kills++;
    if (e.role === 'cop') { G.state.stats.copsDown++; G.police.addWanted(G, 1, 'Cop down'); }
    G.hud.feed(`${e.role === 'cop' ? 'SPPD officer' : e.role === 'guard' ? 'Guard' : 'Target'} down (${cause})`);
    G.fx.spawnSmoke(e.ped.x, e.ped.z, 4);
  }

  // Shoot from the camera through the crosshair: nearest enemy within a cone.
  function tryFire(G) {
    const s = G.state;
    const def = WEAPONS[s.weapon];
    if (s.reloading > 0 || fireCooldown > 0) return false;
    if (s.weapon !== 'fists' && s.mag[s.weapon] <= 0) {
      G.audio.click(); G.hud.toast('Empty — press R to reload');
      return false;
    }
    fireCooldown = def.rate;
    lastShotAt = s.time;
    s.stats.shots++;
    if (s.weapon !== 'fists') s.mag[s.weapon]--;
    G.audio.gunshot(s.weapon);
    G.fx.spawnMuzzle(G);
    // firing direction: camera forward on the ground plane
    const cam = G.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const ox = s.player.x, oz = s.player.z;
    const aimX = dir.x, aimZ = dir.z;
    const aimLen = Math.hypot(aimX, aimZ) || 1;
    let best = null, bestD = def.range;
    let bestPed = null;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.ped.x - ox, dz = e.ped.z - oz;
      const d = Math.hypot(dx, dz);
      if (d > def.range) continue;
      const dot = (dx * aimX + dz * aimZ) / (d * aimLen);
      if (dot > 0.94 && d < bestD) { bestD = d; best = e; }
    }
    if (!best) {
      // peds can be hit too (a crime — the city notices)
      const ped = G.pedestrians.nearest(ox + aimX * 6, oz + aimZ * 6, def.range, (p) => !p.isCop && !p.isGuard);
      if (ped) {
        const dx = ped.x - ox, dz = ped.z - oz;
        const d = Math.hypot(dx, dz);
        const dot = (dx * aimX + dz * aimZ) / (d * aimLen);
        if (d < def.range && dot > 0.94) bestPed = ped;
      }
    }
    if (s.weapon === 'fists') {
      if (best) { hitTarget(G, best, def, null); G.audio.thud(); }
      else if (bestPed) { hitTarget(G, { ped: bestPed, hp: bestPed.hp }, def, bestPed); G.audio.thud(); }
      return true;
    }
    if (best) hitTarget(G, best, def, null);
    else if (bestPed) hitTarget(G, { ped: bestPed, hp: bestPed.hp }, def, bestPed);
    else {
      // stray shot into the street: sparks on the ground ahead
      G.fx.spawnSparks(ox + aimX * 10, oz + aimZ * 10);
    }
    return true;
  }

  function hitTarget(G, target, def, ped) {
    let dmg = def.damage;
    if (def.pellets > 1) dmg = def.damage * (3 + Math.floor(Math.random() * 4));
    G.hud.hitmarker();
    G.fx.spawnSparks(target.ped.x, target.ped.z);
    if (ped) {
      ped.alive = false; ped.mesh.visible = false;
      G.state.stats.pedsHit++;
      G.police.addWanted(G, 1, 'Pedestrian shot');
      G.hud.feed('Pedestrian shot — +1 ★');
      return;
    }
    target.hp -= dmg;
    if (target.hp <= 0) killEnemy(G, target, def.name || 'shot');
  }

  function step(dt, G) {
    fireCooldown = Math.max(0, fireCooldown - dt);
    const s = G.state;
    if (s.reloading > 0) {
      s.reloading -= dt;
      if (s.reloading <= 0) {
        const def = WEAPONS[s.weapon];
        const need = def.mag - s.mag[s.weapon];
        const take = Math.min(need, s.ammo[s.weapon]);
        s.mag[s.weapon] += take; s.ammo[s.weapon] -= take;
        G.audio.reload();
      }
    }
    // enemies return fire when the player is near and visible
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = s.player.x - e.ped.x, dz = s.player.z - e.ped.z;
      const d = Math.hypot(dx, dz);
      if (d < 42 && s.screen === 'play') {
        e.shootT -= dt;
        if (e.shootT <= 0) {
          e.shootT = 1.1 + Math.random() * 1.4;
          // face the player and fire a tracer-ish burst
          e.ped.heading = Math.atan2(dx, dz);
          e.ped.mesh.rotation.y = e.ped.heading;
          G.fx.spawnMuzzleAt(e.ped.x, e.ped.z, e.ped.heading);
          G.audio.enemyShot(d);
          if (d < 34 && Math.random() < clamp(0.55 - d / 90, 0.12, 0.5)) {
            damagePlayer(G, e.role === 'guard' ? 9 : 7);
            G.hud.feed(`${e.role === 'guard' ? 'Guard' : 'Cop'} hit you`);
          }
        }
      }
    }
  }

  return {
    enemies, addEnemy, explode: (G, x, z, r) => explode(G, x, z, r),
    tryFire, damagePlayer, killEnemy, step,
    get lastShotAt() { return lastShotAt; },
    setLastShot(t) { lastShotAt = t; },
  };
}
