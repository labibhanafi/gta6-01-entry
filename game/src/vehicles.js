// Cars: box-built models per type, arcade driving physics, traffic AI that
// follows the road grid, collisions with buildings and other cars.
import * as THREE from 'three';
import { VEHICLES } from './config.js';
import { mulberry32, range, pick, clamp } from './random.js';
import { roadLines } from './city.js';

export function makeCarMesh(type) {
  const def = VEHICLES[type] || VEHICLES.marlow;
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: def.color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x18242e });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const L = def.len;
  const W = def.wid;
  const bodyH = type === 'van' ? 1.5 : 0.75;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, bodyH, L), paint);
  body.position.y = 0.55 + bodyH / 2 - 0.35;
  body.castShadow = true;
  g.add(body);
  if (type !== 'van') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, 0.62, L * 0.46), glass);
    cabin.position.set(0, 1.05, type === 'bruto' ? 0.55 : -0.15);
    cabin.castShadow = true;
    g.add(cabin);
  }
  if (type === 'bruto') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.35, L * 0.4), dark);
    bed.position.set(0, 0.95, -L * 0.26);
    g.add(bed);
  }
  if (type === 'taxista') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    sign.position.set(0, 1.45, -0.1);
    g.add(sign);
    const check = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    check.position.set(0, 0.72, 0);
    g.add(check);
  }
  if (type === 'cruiser') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(W * 0.6, 0.16, 0.5), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    bar.position.set(0, 1.42, -0.15);
    g.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.22, L * 0.7), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    stripe.position.set(0, 0.62, 0);
    g.add(stripe);
  }
  // headlights / taillights
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tl = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), hl);
    h.position.set(sx * (W / 2 - 0.3), 0.62, L / 2 + 0.02);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tl);
    t.position.set(sx * (W / 2 - 0.3), 0.62, -L / 2 - 0.02);
    g.add(t);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-W / 2, L / 2 - 0.8], [W / 2, L / 2 - 0.8], [-W / 2, -L / 2 + 0.8], [W / 2, -L / 2 + 0.8]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(wx, 0.36, wz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.type = type;
  return g;
}

export function createVehicle(scene, type, x, z, yaw, opts = {}) {
  const def = VEHICLES[type];
  const mesh = makeCarMesh(type);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = yaw;
  scene.add(mesh);
  const v = {
    mesh, type, def,
    x, z, yaw,
    speed: 0,
    hp: def.hp,
    maxHp: def.hp,
    driver: opts.driver || 'none', // 'player' | 'traffic' | 'cop' | 'mission' | 'none'
    isPolice: type === 'cruiser',
    smoking: false,
    dead: false,
    // traffic AI
    axis: opts.axis || 'x',
    dir: opts.dir || 1,
    road: opts.road ?? 0,
    stuck: 0,
    light: null, // flashing light bar for cruisers
  };
  if (v.isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    bar.position.set(0, 1.55, -0.15);
    mesh.add(bar);
    v.light = bar;
  }
  return v;
}

// Simple AABB-vs-circle pushout against building colliders.
export function collideCircle(colliders, x, z, r) {
  let nx = x;
  let nz = z;
  let hit = false;
  for (const c of colliders) {
    const cx = clamp(x, c.minX, c.maxX);
    const cz = clamp(z, c.minZ, c.maxZ);
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        nz = cz + (dz / d) * r;
      } else {
        // centre inside the box: push out along the smallest penetration
        const pl = x - (c.minX - r);
        const pr = (c.maxX + r) - x;
        const pt = z - (c.minZ - r);
        const pb = (c.maxZ + r) - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) nx = c.minX - r;
        else if (m === pr) nx = c.maxX + r;
        else if (m === pt) nz = c.minZ - r;
        else nz = c.maxZ + r;
      }
      x = nx;
      z = nz;
    }
  }
  return { x: nx, z: nz, hit };
}

export function pointInCollider(colliders, x, z) {
  for (const c of colliders) {
    if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return true;
  }
  return false;
}

// Arcade driving: accel/brake, steer scaled by speed, handbrake drift, drag.
export function driveVehicle(v, input, dt, colliders, fx) {
  const def = v.def;
  const fwd = input.has('KeyW') ? 1 : input.has('KeyS') ? -0.6 : 0;
  if (fwd > 0) v.speed += def.accel * fwd * dt;
  else if (fwd < 0) v.speed += def.accel * fwd * dt * 1.1;
  else v.speed *= Math.pow(0.4, dt); // coast drag
  if (input.has('Space')) {
    // handbrake: strong decel + drift slide
    v.speed *= Math.pow(0.12, dt);
    if (Math.abs(v.speed) > 6 && fx) {
      const bx = v.x - Math.sin(v.yaw) * 1.5;
      const bz = v.z - Math.cos(v.yaw) * 1.5;
      fx.skid(bx, 0.1, bz);
    }
  }
  v.speed = clamp(v.speed, -def.top * 0.45, def.top);
  const steerIn = (input.has('KeyA') ? 1 : 0) - (input.has('KeyD') ? 1 : 0);
  const steerScale = clamp(Math.abs(v.speed) / 12, 0, 1) * (v.speed >= 0 ? 1 : -1);
  v.yaw += steerIn * def.steer * steerScale * dt * (input.has('Space') ? 1.5 : 1);
  const nx = v.x + Math.sin(v.yaw) * v.speed * dt;
  const nz = v.z + Math.cos(v.yaw) * v.speed * dt;
  const res = collideCircle(colliders, nx, nz, 1.6);
  if (res.hit && Math.abs(v.speed) > 4) {
    v.hp -= Math.abs(v.speed) * 0.35;
    if (fx) fx.burst(v.x, 0.8, v.z, 8, 0xffcc55, 3);
    v.speed *= 0.35;
  }
  v.x = clamp(res.x, -295, 295);
  v.z = clamp(res.z, -295, 330);
  // smoke when hurt
  if (v.hp < v.maxHp * 0.4 && !v.smoking) v.smoking = true;
  if (v.smoking && fx && Math.random() < 0.35) fx.smoke(v.x, 1.2, v.z, 1);
  v.mesh.position.set(v.x, 0, v.z);
  v.mesh.rotation.y = v.yaw;
  // wheel spin + front steer visual
  const wheels = v.mesh.userData.wheels;
  if (wheels) {
    for (const w of wheels) w.rotation.x += v.speed * dt * 1.4;
  }
  return v;
}

// Traffic AI: cruise along a road line, turn at intersections, slow for cars ahead.
export function updateTraffic(v, dt, colliders, others, fx) {
  const lines = roadLines();
  const speedTarget = 11;
  // pick a new road at an intersection
  const onLine = Math.abs(v.x - v.road) < 1.2 || Math.abs(v.z - v.road) < 1.2;
  if (v.axis === 'x') {
    // moving along x at z = road
    let target = v.z;
    const atCross = lines.some((l) => Math.abs(v.x - l) < 1.5);
    if (atCross && Math.random() < dt * 0.25) {
      // turn onto the crossing road
      v.axis = 'z';
      v.road = v.x;
      v.dir = Math.random() < 0.5 ? 1 : -1;
      v.yaw = v.dir > 0 ? 0 : Math.PI;
    }
    v.z += (target - v.z) * Math.min(1, dt * 3);
  } else {
    const atCross = lines.some((l) => Math.abs(v.z - l) < 1.5);
    if (atCross && Math.random() < dt * 0.25) {
      v.axis = 'x';
      v.road = v.z;
      v.dir = Math.random() < 0.5 ? 1 : -1;
      v.yaw = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    v.x += (v.road - v.x) * Math.min(1, dt * 3);
  }
  // slow for a car ahead on the same lane
  let slow = false;
  const fx0 = Math.sin(v.yaw);
  const fz0 = Math.cos(v.yaw);
  for (const o of others) {
    if (o === v || o.dead) continue;
    const dx = o.x - v.x;
    const dz = o.z - v.z;
    const ahead = dx * fx0 + dz * fz0;
    const side = Math.abs(dx * fz0 - dz * fx0);
    if (ahead > 0 && ahead < 12 && side < 2.6) { slow = true; break; }
  }
  const want = slow ? 0 : speedTarget;
  v.speed += (want - v.speed) * Math.min(1, dt * 1.2);
  const nx = v.x + Math.sin(v.yaw) * v.speed * dt;
  const nz = v.z + Math.cos(v.yaw) * v.speed * dt;
  const res = collideCircle(colliders, nx, nz, 1.6);
  v.x = clamp(res.x, -295, 295);
  v.z = clamp(res.z, -295, 330);
  if (res.hit) v.speed = 0;
  v.mesh.position.set(v.x, 0, v.z);
  v.mesh.rotation.y = v.yaw;
  const wheels = v.mesh.userData.wheels;
  if (wheels) for (const w of wheels) w.rotation.x += v.speed * dt * 1.4;
  void onLine;
  void fx;
}

export function spawnTraffic(scene, seed, count = 12) {
  const rng = mulberry32(seed);
  const lines = roadLines();
  const types = ['vento', 'bruto', 'taxista', 'marlow', 'kroll', 'van'];
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const road = pick(rng, lines);
    const along = range(rng, -250, 250);
    const dir = rng() < 0.5 ? 1 : -1;
    const type = pick(rng, types);
    const x = axis === 'x' ? along : road + (rng() < 0.5 ? -2.5 : 2.5);
    const z = axis === 'x' ? road + (rng() < 0.5 ? -2.5 : 2.5) : along;
    const yaw = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const v = createVehicle(scene, type, x, z, yaw, { driver: 'traffic', axis, dir, road: axis === 'x' ? z : x });
    v.speed = range(rng, 8, 12);
    out.push(v);
  }
  return out;
}

// Parked cars the player can steal, placed near curbs and lots.
export function spawnParked(scene, seed, count = 10) {
  const rng = mulberry32(seed + 99);
  const lines = roadLines();
  const types = ['vento', 'bruto', 'taxista', 'marlow', 'kroll', 'van'];
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const road = pick(rng, lines);
    const along = range(rng, -250, 240);
    const side = rng() < 0.5;
    const x = side ? along : road + 8.6;
    const z = side ? road + 8.6 : along;
    if (z > 232) continue;
    const type = pick(rng, types);
    const yaw = side ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const v = createVehicle(scene, type, x, z, yaw, { driver: 'none' });
    out.push(v);
  }
  return out;
}
