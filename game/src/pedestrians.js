// Pedestrians: walkers on sidewalks, idle chatter poses, and a flee response
// when gunfire or a speeding car comes near. Simple box people with colour
// variety; no borrowed characters.
import * as THREE from 'three';
import { mulberry32, range, pick, clamp } from './random.js';
import { roadLines } from './city.js';

const SHIRTS = [0xe86a5a, 0x5a8ae8, 0x7ac74f, 0xe8c85a, 0x9a6ad8, 0xffffff, 0x2b2f36, 0xe89a5a];
const PANTS = [0x2b3a4a, 0x3a2b2b, 0x4a4a4a, 0x2b4a2b, 0x5a4a6a];

function makePedMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: pick(rng, PANTS) });
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf2c9a0]) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
  head.position.y = 1.62;
  head.castShadow = true;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), pants);
  legL.position.set(-0.14, 0.31, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.16), shirt);
  armL.position.set(-0.36, 1.05, 0);
  const armR = armL.clone();
  armR.position.x = 0.36;
  g.add(body, head, legL, legR, armL, armR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  g.userData.armL = armL;
  g.userData.armR = armR;
  return g;
}

export function spawnPeds(scene, seed, count = 24) {
  const rng = mulberry32(seed);
  const lines = roadLines();
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const mesh = makePedMesh(rng);
    const road = pick(rng, lines);
    const along = range(rng, -260, 260);
    const side = rng() < 0.5;
    const x = side ? along : road + 8.2;
    const z = side ? road + 8.2 : along;
    if (z > 235) continue;
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    out.push({
      mesh,
      x, z,
      yaw: rng() * Math.PI * 2,
      speed: range(rng, 0.9, 1.7),
      walkPhase: rng() * 6,
      flee: 0, // seconds of fleeing left
      fleeX: 0, fleeZ: 0,
      hp: 100,
      alive: true,
      road,
      axis: side ? 'x' : 'z',
      dir: rng() < 0.5 ? 1 : -1,
    });
  }
  return out;
}

export function updatePeds(peds, dt, danger, time) {
  // danger: {x, z, r} gunfire / explosion centre, or null
  for (const p of peds) {
    if (!p.alive) continue;
    if (danger) {
      const dx = p.x - danger.x;
      const dz = p.z - danger.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < danger.r * danger.r) {
        p.flee = 3 + Math.random() * 2;
        p.fleeX = dx;
        p.fleeZ = dz;
      }
    }
    let vx = 0;
    let vz = 0;
    if (p.flee > 0) {
      p.flee -= dt;
      const len = Math.hypot(p.fleeX, p.fleeZ) || 1;
      vx = (p.fleeX / len) * 4.2;
      vz = (p.fleeZ / len) * 4.2;
    } else {
      // stroll along the sidewalk line
      if (p.axis === 'x') {
        vx = p.dir * p.speed;
        if (p.x > 275 || p.x < -275) p.dir *= -1;
      } else {
        vz = p.dir * p.speed;
        if (p.z > 230 || p.z < -275) p.dir *= -1;
      }
    }
    p.x = clamp(p.x + vx * dt, -285, 285);
    p.z = clamp(p.z + vz * dt, -285, 232);
    if (vx !== 0 || vz !== 0) p.yaw = Math.atan2(vx, vz);
    p.walkPhase += dt * (p.flee > 0 ? 11 : 5);
    const swing = Math.sin(p.walkPhase) * 0.5;
    p.mesh.userData.legL.rotation.x = swing;
    p.mesh.userData.legR.rotation.x = -swing;
    p.mesh.userData.armL.rotation.x = -swing * 0.7;
    p.mesh.userData.armR.rotation.x = swing * 0.7;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.yaw;
    void time;
  }
}
