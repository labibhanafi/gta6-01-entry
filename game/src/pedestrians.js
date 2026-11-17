// SOLMAR — pedestrians: sidewalk walkers who stroll, cross at corners and
// flee when shots are fired or a car bears down on them.
import * as THREE from 'three';
import { createRandom, range, pick, clamp } from './random.js';
import { ROADS } from './config.js';

const SHIRTS = [0xe86a5a, 0x5a8ae8, 0x7ed07a, 0xe8c85a, 0xb07ad0, 0xe8e8e8, 0x3a3f46, 0xff9a6a];
const PANTS = [0x2a3547, 0x4a3a2a, 0x5a5a5a, 0x274a2a];

export function createPedestrians(scene, city, seed) {
  const rng = createRandom(seed ^ 0x9ed5);
  const peds = [];
  const group = new THREE.Group();
  scene.add(group);

  function buildMesh(shirt, pants) {
    const g = new THREE.Group();
    const legMat = new THREE.MeshLambertMaterial({ color: pants });
    const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd8a878 });
    const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), legMat); lLeg.position.set(-0.14, 0.4, 0); g.add(lLeg);
    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), legMat); rLeg.position.set(0.14, 0.4, 0); g.add(rLeg);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), shirtMat); torso.position.y = 1.15; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skinMat); head.position.y = 1.72; head.castShadow = true; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0x1a1a1a, 0x4a2a10, 0x8a6a2a, 0x888888]) }));
    hair.position.y = 1.76; g.add(hair);
    g.userData = { lLeg, rLeg };
    return g;
  }

  function randomSidewalkSpot() {
    const road = pick(rng, ROADS);
    const along = range(rng, -260, 260);
    const off = pick(rng, [-9.5, 9.5]);
    return rng() < 0.5 ? { x: road + off, z: along } : { x: along, z: road + off };
  }

  function addPed(x, z, opts = {}) {
    const mesh = buildMesh(pick(rng, SHIRTS), pick(rng, PANTS));
    mesh.position.set(x, 0, z);
    group.add(mesh);
    const ped = {
      mesh, x, z, heading: range(rng, 0, Math.PI * 2),
      speed: range(rng, 1.0, 1.8), state: 'walk', // walk | flee | down | passenger
      target: randomSidewalkSpot(), fleeT: 0, walkPhase: rng() * 6,
      hp: 100, isCop: !!opts.isCop, isGuard: !!opts.isGuard, isDriver: !!opts.isDriver,
      shootT: range(rng, 0.5, 1.5), alive: true, name: opts.name || 'ped',
    };
    peds.push(ped);
    return ped;
  }

  for (let i = 0; i < 24; i++) {
    const s = randomSidewalkSpot();
    addPed(s.x, s.z);
  }

  function step(dt, G) {
    const px = G.state.player.x, pz = G.state.player.z;
    const gunfire = G.combat && G.combat.lastShotAt > G.state.time - 1.2;
    for (const ped of peds) {
      if (!ped.alive) continue;
      // flee: gunfire nearby, or a fast car heading at them
      let flee = ped.state === 'flee';
      if (gunfire) {
        const d2 = (ped.x - px) ** 2 + (ped.z - pz) ** 2;
        if (d2 < 900) flee = true;
      }
      const p = G.state.player;
      if (p.inCar) {
        const car = G.vehicles.byId(p.carId);
        if (car) {
          const d2 = (ped.x - car.x) ** 2 + (ped.z - car.z) ** 2;
          if (d2 < 100 && Math.abs(car.speed) > 6) flee = true;
        }
      }
      if (flee) {
        ped.state = 'flee'; ped.fleeT = 1.5;
        const dx = ped.x - px, dz = ped.z - pz;
        const d = Math.hypot(dx, dz) || 1;
        ped.heading = Math.atan2(dx / d, dz / d);
        ped.speed = 4.6;
      } else if (ped.state === 'flee') {
        ped.fleeT -= dt;
        if (ped.fleeT <= 0) { ped.state = 'walk'; ped.speed = range(rng, 1.0, 1.8); ped.target = randomSidewalkSpot(); }
      }
      if (ped.state === 'walk') {
        const dx = ped.target.x - ped.x, dz = ped.target.z - ped.z;
        const d = Math.hypot(dx, dz);
        if (d < 2) { ped.target = randomSidewalkSpot(); }
        else {
          const want = Math.atan2(dx, dz);
          let diff = want - ped.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          ped.heading += clamp(diff, -2.4 * dt, 2.4 * dt);
        }
      }
      if (ped.state === 'passenger') {
        // passenger waits in place (taxi job) — no movement
      } else {
        ped.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.z += Math.cos(ped.heading) * ped.speed * dt;
        ped.x = clamp(ped.x, -288, 288); ped.z = clamp(ped.z, -288, 292);
        if (city.hits(ped.x, ped.z, 0.5)) {
          // step back out of the building
          ped.x -= Math.sin(ped.heading) * ped.speed * dt;
          ped.z -= Math.cos(ped.heading) * ped.speed * dt;
          ped.target = randomSidewalkSpot();
        }
      }
      // car hits ped
      if (p.inCar) {
        const car = G.vehicles.byId(p.carId);
        if (car && !car.dead && Math.abs(car.speed) > 4) {
          const d2 = (ped.x - car.x) ** 2 + (ped.z - car.z) ** 2;
          if (d2 < 4.2) {
            ped.alive = false; ped.mesh.visible = false;
            G.state.stats.pedsHit++;
            G.police.addWanted(1, 'Hit a pedestrian');
            G.hud.feed(`Pedestrian down — +1 ★`);
            G.audio.thud();
          }
        }
      }
      ped.walkPhase += dt * ped.speed * 3;
      const swing = Math.sin(ped.walkPhase) * 0.5;
      ped.mesh.userData.lLeg.rotation.x = swing;
      ped.mesh.userData.rLeg.rotation.x = -swing;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
  }

  return {
    peds, addPed,
    step,
    nearest(x, z, maxD, filter) {
      let best = null, bd = maxD * maxD;
      for (const p of peds) {
        if (!p.alive) continue;
        if (filter && !filter(p)) continue;
        const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d2 < bd) { bd = d2; best = p; }
      }
      return best;
    },
    countAlive() { return peds.filter((p) => p.alive).length; },
  };
}
