// SOLMAR — vehicles: box-built car models, arcade driving physics,
// traffic AI on the road grid, parked cars, and steal / enter / exit.
import * as THREE from 'three';
import { VEHICLES, ROADS, CITY } from './config.js';
import { createRandom, range, pick, clamp, angleLerp } from './random.js';

export function buildCarMesh(type) {
  const def = VEHICLES[type];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: def.color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const chromeMat = new THREE.MeshLambertMaterial({ color: 0xc8ccd4 });
  const isVan = type === 'van';
  const isPickup = type === 'bruto';
  const len = isVan ? 5.2 : type === 'kroll' ? 4.9 : 4.4;
  const wid = isVan ? 2.2 : 2.0;
  const bodyH = isVan ? 1.5 : 0.75;

  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, bodyH, len), bodyMat);
  body.position.y = 0.75; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.3, isVan ? 1.0 : 0.65,
    isVan ? 3.4 : len * 0.5), isVan ? bodyMat : darkMat);
  cabin.position.set(0, bodyH + 0.55, isVan ? -0.4 : -0.2); cabin.castShadow = true; g.add(cabin);
  if (isPickup) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.2, 0.5, 1.6), darkMat);
    bed.position.set(0, 1.15, 1.35); g.add(bed);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [wx, wz] of [[-wid / 2, len / 2 - 0.8], [wid / 2, len / 2 - 0.8], [-wid / 2, -len / 2 + 0.8], [wid / 2, -len / 2 + 0.8]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w); wheels.push(w);
  }
  // headlights + taillights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), headMat);
    h.position.set(sx, 0.85, len / 2 + 0.02); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), tailMat);
    t.position.set(sx, 0.85, -len / 2 - 0.02); g.add(t);
  }
  if (type === 'cruiser') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2244 }));
    bar.position.set(0, 1.75, -0.2); g.add(bar);
    g.userData.lightBar = bar;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.02, 0.2, len + 0.02),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    stripe.position.y = 0.95; g.add(stripe);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    sign.position.set(0, 1.65, -0.2); g.add(sign);
  }
  g.userData.wheels = wheels;
  return g;
}

export function createVehicles(scene, city, seed) {
  const rng = createRandom(seed ^ 0xca25);
  const cars = [];
  let nextId = 0;

  function addCar(type, x, z, heading, opts = {}) {
    const def = VEHICLES[type];
    const mesh = buildCarMesh(type);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const car = {
      id: nextId++, type, def, mesh, x, z, heading,
      speed: 0, steer: 0, hp: def.hp, maxHp: def.hp,
      traffic: !!opts.traffic, parked: !!opts.parked, police: type === 'cruiser',
      driver: opts.traffic ? true : false, // traffic cars carry a driver ped
      target: null, wait: 0, smoke: 0, dead: false, wheelSpin: 0,
    };
    cars.push(car);
    return car;
  }

  // parked cars along the roads (stealable)
  const parkedTypes = ['vento', 'marlow', 'taxi', 'bruto', 'kroll', 'van', 'marlow', 'vento'];
  const parkedSpots = [
    [37.5 + 5.5, 60, Math.PI], [37.5 - 5.5, -90, 0], [-37.5 + 5.5, 120, Math.PI],
    [112.5 + 5.5, -40, Math.PI], [-112.5 - 5.5, 30, 0], [187.5 + 5.5, 150, Math.PI],
    [-187.5 - 5.5, -150, 0], [262.5 - 5.5, -60, Math.PI],
  ];
  parkedSpots.forEach(([x, z, h], i) => addCar(parkedTypes[i], x, z, h, { parked: true }));

  // traffic cars on the grid
  const trafficTypes = ['marlow', 'taxi', 'bruto', 'van', 'kroll', 'marlow', 'taxi', 'van', 'bruto', 'marlow', 'kroll', 'taxi'];
  for (let i = 0; i < 12; i++) {
    const road = pick(rng, ROADS);
    const along = range(rng, -250, 250);
    const vertical = rng() < 0.5;
    const x = vertical ? road + (rng() < 0.5 ? 3.2 : -3.2) : along;
    const z = vertical ? along : road + (rng() < 0.5 ? 3.2 : -3.2);
    const heading = vertical ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const car = addCar(trafficTypes[i], x, z, heading, { traffic: true });
    car.speed = range(rng, 8, 13);
    car.target = pickNextTarget(rng, car);
  }

  function pickNextTarget(r, car) {
    // next intersection on the car's current road, then a random turn
    const onVertical = Math.abs(Math.sin(car.heading)) < 0.5;
    const roadCoord = onVertical ? car.x : car.z;
    const near = ROADS.reduce((a, b) => Math.abs(b - roadCoord) < Math.abs(a - roadCoord) ? b : a, ROADS[0]);
    const dir = onVertical ? Math.sign(Math.cos(car.heading)) : Math.sign(-Math.sin(car.heading));
    const along = onVertical ? car.z : car.x;
    let next = null;
    for (const c of ROADS) {
      if (dir > 0 && c > along + 10) { next = c; break; }
      if (dir < 0 && c < along - 10) { next = c; }
    }
    if (next === null) next = dir > 0 ? 262.5 : -262.5;
    const turnRoad = pick(r, ROADS);
    return onVertical ? { x: near, z: next, then: { x: turnRoad, z: next } }
                      : { x: next, z: near, then: { x: next, z: turnRoad } };
  }

  function stepTraffic(car, dt, G) {
    if (!car.target) car.target = pickNextTarget(rng, car);
    const t = car.target;
    const dx = t.x - car.x, dz = t.z - car.z;
    const d = Math.hypot(dx, dz);
    if (d < 3) {
      if (t.then) { car.target = { x: t.then.x, z: t.then.z, then: null }; return; }
      car.target = pickNextTarget(rng, car);
      return;
    }
    const want = Math.atan2(dx, dz);
    car.heading = angleLerp(car.heading, want, Math.min(1, dt * 3.2));
    // slow for a car ahead on the same lane
    let targetSpeed = 11;
    for (const other of cars) {
      if (other === car || other.dead) continue;
      const ox = other.x - car.x, oz = other.z - car.z;
      const fwd = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
      const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
      if (fwd > 0 && fwd < 12 && side < 3) { targetSpeed = 0; break; }
    }
    // slow near the player car to avoid cheap pile-ups
    const p = G.state.player;
    if (p.inCar) {
      const pc = cars[p.carId];
      if (pc && pc !== car) {
        const ox = pc.x - car.x, oz = pc.z - car.z;
        const fwd = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
        const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
        if (fwd > 0 && fwd < 10 && side < 3.5) targetSpeed = 0;
      }
    }
    car.speed += clamp(targetSpeed - car.speed, -14 * dt, 8 * dt);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    // keep inside the city; U-turn at the edge
    if (Math.abs(car.x) > 285 || Math.abs(car.z) > 285) {
      car.heading += Math.PI; car.target = pickNextTarget(rng, car);
    }
  }

  function stepDrive(car, input, dt, G) {
    const def = car.def;
    const fwd = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const handbrake = input.handbrake;
    if (fwd > 0) car.speed += def.accel * dt * (car.speed < 0 ? 2.2 : 1);
    else if (fwd < 0) car.speed -= (car.speed > 0 ? def.accel * 1.4 : def.accel * 0.7) * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
    if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 18 * dt);
    car.speed = clamp(car.speed, -12, def.maxSpeed);
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const steerMax = 0.55 * clamp(1 - Math.abs(car.speed) / def.maxSpeed * 0.55, 0.45, 1);
    car.steer += clamp(steerTarget * steerMax - car.steer, -3.2 * dt, 3.2 * dt);
    const grip = handbrake ? 0.35 : 1;
    car.heading += (car.steer * car.speed * 0.055 * grip) * dt * (car.speed >= 0 ? 1 : -1);
    if (handbrake && Math.abs(car.speed) > 14 && Math.abs(car.steer) > 0.15) {
      G.fx.spawnSkid(car.x, car.z, car.heading);
    }
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    if (city.hits(nx, nz, 1.6)) {
      const dmg = Math.abs(car.speed) * 1.6;
      if (dmg > 6) { car.hp -= dmg; G.fx.spawnSmoke(car.x, car.z, 6); G.audio.thud(); G.fx.shake(Math.min(0.5, dmg / 40)); }
      car.speed *= -0.25;
    } else {
      car.x = nx; car.z = nz;
    }
    car.x = clamp(car.x, -292, 292); car.z = clamp(car.z, -292, 296);
    // car-vs-car bumps
    for (const other of cars) {
      if (other === car || other.dead) continue;
      const dx = other.x - car.x, dz = other.z - car.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d) / 2;
        car.x -= (dx / d) * push; car.z -= (dz / d) * push;
        other.x += (dx / d) * push; other.z += (dz / d) * push;
        const impact = Math.abs(car.speed - other.speed);
        if (impact > 6) {
          car.hp -= impact * 0.8; other.hp -= impact * 0.8;
          G.fx.spawnSmoke(car.x, car.z, 4); G.audio.thud();
        }
        if (!other.traffic && other.parked) other.parked = false;
        car.speed *= 0.6; other.speed *= 0.5;
      }
    }
    if (car.hp <= 0 && !car.dead) {
      car.dead = true;
      G.combat.explode(G, car.x, car.z, 8);
    }
  }

  function syncMeshes(dt) {
    for (const car of cars) {
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      car.wheelSpin += car.speed * dt * 2.4;
      for (const w of car.mesh.userData.wheels || []) w.rotation.x = car.wheelSpin;
      // damage smoke
      if (car.hp < 45 && car.hp > 0 && !car.dead) {
        car.smoke += dt;
        if (car.smoke > 0.25) { car.smoke = 0; }
      }
      car.mesh.visible = !car.dead;
    }
  }

  return {
    cars, addCar,
    byId(id) { return cars[id]; },
    nearestCar(x, z, maxD) {
      let best = null, bd = maxD * maxD;
      for (const c of cars) {
        if (c.dead) continue;
        const d2 = (c.x - x) ** 2 + (c.z - z) ** 2;
        if (d2 < bd) { bd = d2; best = c; }
      }
      return best;
    },
    step(dt, G) {
      for (const car of cars) {
        if (car.dead) continue;
        if (car.traffic && !G.state.player.inCar) stepTraffic(car, dt, G);
        else if (car.traffic && G.state.player.carId !== car.id) stepTraffic(car, dt, G);
      }
      const p = G.state.player;
      if (p.inCar) {
        const car = cars[p.carId];
        if (car && !car.dead) stepDrive(car, G.input, dt, G);
      }
      syncMeshes(dt);
    },
  };
}
