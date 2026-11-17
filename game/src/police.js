// SOLMAR — wanted level (0–5 stars), police cruisers + foot cops, pursuit,
// ramming, bust / escape logic and wanted decay.
import { createRandom, range, pick, clamp, angleLerp } from './random.js';
import { ROADS } from './config.js';

export function createPolice(scene, city, seed) {
  const rng = createRandom(seed ^ 0x9011);
  const cruisers = [];   // police car objects (from vehicles.addCar)
  const cops = [];       // foot cop peds (managed here, meshes in pedestrians)
  let spawnT = 0;

  function wantedCount(G) {
    return 1 + Math.floor(G.state.wanted / 2); // cruisers on the street
  }

  function spawnCruiser(G, nearX, nearZ) {
    const road = pick(rng, ROADS);
    const vertical = rng() < 0.5;
    const x = vertical ? road : nearX + range(rng, -40, 40);
    const z = vertical ? nearZ + range(rng, -40, 40) : road;
    const heading = Math.atan2(nearX - x, nearZ - z);
    const car = G.vehicles.addCar('cruiser', clamp(x, -280, 280), clamp(z, -280, 280), heading, {});
    car.traffic = false; car.police = true;
    car.speed = 10;
    cruisers.push(car);
    return car;
  }

  function spawnFootCop(G, x, z) {
    const ped = G.pedestrians.addPed(x, z, { isCop: true, name: 'SPPD officer' });
    ped.state = 'walk'; ped.speed = 2.6;
    cops.push(ped);
    return ped;
  }

  function step(dt, G) {
    const s = G.state;
    spawnT -= dt;
    // keep the cruiser fleet at the wanted count
    const want = s.wanted > 0 ? wantedCount(G) : 0;
    const alive = cruisers.filter((c) => !c.dead);
    if (alive.length < want && spawnT <= 0) {
      spawnT = 1.2;
      spawnCruiser(G, s.player.x, s.player.z);
    }
    // foot cops at wanted >= 2
    if (s.wanted >= 2 && cops.filter((c) => c.alive).length < s.wanted - 1 && spawnT <= 0) {
      spawnT = 2;
      spawnFootCop(G, s.player.x + range(rng, -25, 25), s.player.z + range(rng, -25, 25));
    }
    // cruiser pursuit: steer at the player, ram, and despawn far away when clean
    const px = s.player.inCar ? G.vehicles.byId(s.player.carId)?.x ?? s.player.x : s.player.x;
    const pz = s.player.inCar ? G.vehicles.byId(s.player.carId)?.z ?? s.player.z : s.player.z;
    for (const car of alive) {
      const dx = px - car.x, dz = pz - car.z;
      const d = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      car.heading = angleLerp(car.heading, wantHeading, Math.min(1, dt * 2.2));
      const targetSpeed = d > 60 ? 40 : d > 18 ? 34 : 24;
      car.speed += clamp(targetSpeed - car.speed, -18 * dt, 14 * dt);
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      if (!city.hits(nx, nz, 1.6)) { car.x = nx; car.z = nz; }
      else { car.heading += 0.9 * dt; car.speed *= 0.7; }
      // ram the player's car
      if (s.player.inCar) {
        const pc = G.vehicles.byId(s.player.carId);
        if (pc && !pc.dead) {
          const d2 = (pc.x - car.x) ** 2 + (pc.z - car.z) ** 2;
          if (d2 < 12) {
            pc.hp -= 6 * dt; car.speed *= 0.96;
            if (pc.hp <= 0 && !pc.dead) { pc.dead = true; G.combat.explode(G, pc.x, pc.z, 8); }
          }
        }
      }
      // light bar flash
      const bar = car.mesh.userData.lightBar;
      if (bar) bar.material.color.setHex(Math.floor(s.time * 6) % 2 === 0 ? 0xff2244 : 0x2244ff);
      // too far + clean: pull the cruiser off the street
      if (s.wanted === 0 && d > 220) {
        car.dead = true; car.mesh.visible = false;
      }
    }
    // foot cops chase and try to bust
    let nearestCopD = Infinity;
    for (const cop of cops) {
      if (!cop.alive) continue;
      const dx = s.player.x - cop.x, dz = s.player.z - cop.z;
      const d = Math.hypot(dx, dz);
      nearestCopD = Math.min(nearestCopD, d);
      if (s.wanted > 0 && !s.player.inCar) {
        cop.heading = Math.atan2(dx, dz);
        cop.speed = d > 8 ? 5.2 : 3.2;
        cop.x += Math.sin(cop.heading) * cop.speed * dt;
        cop.z += Math.cos(cop.heading) * cop.speed * dt;
        cop.mesh.position.set(cop.x, 0, cop.z);
        cop.mesh.rotation.y = cop.heading;
      }
    }
    // bust: a cop stays close while you are slow / on foot
    if (s.wanted > 0 && !s.player.inCar && nearestCopD < 2.6) {
      s.bustTimer += dt;
      if (s.bustTimer > 2.2) G.missions.busted(G, 'The SPPD hauled you in.');
    } else {
      s.bustTimer = Math.max(0, s.bustTimer - dt * 2);
    }
    // wanted decay: unseen (no cop within 60 m) and far from cruisers
    if (s.wanted > 0) {
      let nearest = Infinity;
      for (const c of alive) nearest = Math.min(nearest, Math.hypot(c.x - px, c.z - pz));
      nearest = Math.min(nearest, nearestCopD);
      if (nearest > 60) {
        s.wantedTimer += dt;
        if (s.wantedTimer > 18) { s.wanted--; s.wantedTimer = 0; if (s.wanted === 0) G.hud.toast('You lost them. Heat is off.'); }
      } else s.wantedTimer = 0;
    }
  }

  return {
    cruisers, cops, step,
    addWanted(G, n, reason) {
      const before = G.state.wanted;
      G.state.wanted = clamp(G.state.wanted + n, 0, 5);
      if (G.state.wanted > before) G.hud.toast(`${reason} — wanted ${'★'.repeat(G.state.wanted)}`);
      if (G.state.wanted > 0) G.state.wantedTimer = 0;
    },
    spawnCruiser, spawnFootCop,
    clearAll(G) {
      for (const c of cruisers) { c.dead = true; c.mesh.visible = false; }
      for (const c of cops) { c.alive = false; c.mesh.visible = false; }
      G.state.wanted = 0; G.state.wantedTimer = 0;
    },
  };
}
