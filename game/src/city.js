// Solmar Bay: 8x8 block grid city, beach + ocean south, pier, park, plaza,
// palms, streetlights, traffic lights, ~90 procedural buildings, sun-coins.
// Returns colliders (AABBs), props for rampage, coin positions and landmarks.
import * as THREE from 'three';
import { CITY, PLACES, SUN_COINS } from './config.js';
import { mulberry32, range, pick, clamp } from './random.js';
import { buildingTexture, roadTexture, sidewalkTexture, sandTexture, grassTexture } from './textures.js';

const ROAD_LINES = [-262.5, -187.5, -112.5, -37.5, 37.5, 112.5, 187.5, 262.5];

export function roadLines() {
  return ROAD_LINES;
}

// Nearest point on the road grid to (x,z) — used by traffic AI.
export function nearestRoad(x, z) {
  let bx = ROAD_LINES[0];
  let bz = ROAD_LINES[0];
  for (const l of ROAD_LINES) {
    if (Math.abs(l - x) < Math.abs(bx - x)) bx = l;
    if (Math.abs(l - z) < Math.abs(bz - z)) bz = l;
  }
  return { x: bx, z: bz };
}

export function buildCity(scene, seed = 7) {
  const rng = mulberry32(seed);
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const props = [];     // smashable street props {mesh, x, z, alive}
  const coins = [];     // {mesh, x, z, y, idx, taken}
  const group = new THREE.Group();
  scene.add(group);

  const roadTex = roadTexture();
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  const walkTex = sidewalkTexture();
  walkTex.wrapS = walkTex.wrapT = THREE.RepeatWrapping;

  // --- Ground: grass base, city slab, beach sand, ocean plane ---
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 760),
    new THREE.MeshLambertMaterial({ color: 0x6f8f57 }),
  );
  base.rotation.x = -Math.PI / 2;
  base.position.set(0, -0.05, 20);
  base.receiveShadow = true;
  group.add(base);

  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 540),
    new THREE.MeshLambertMaterial({ map: walkTex }),
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.set(0, 0, -30);
  slab.receiveShadow = true;
  walkTex.repeat.set(40, 36);
  group.add(slab);

  const sandTex = sandTexture();
  sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
  sandTex.repeat.set(18, 3);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(640, 46),
    new THREE.MeshLambertMaterial({ map: sandTex }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, CITY.beachZ + 21);
  sand.receiveShadow = true;
  group.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 260),
    new THREE.MeshLambertMaterial({ color: 0x1d6f8f, transparent: true, opacity: 0.96 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.05, CITY.oceanZ + 130);
  group.add(ocean);

  // --- Roads: dark strips along every grid line ---
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const l of ROAD_LINES) {
    // [width, depth, x, z, repeatU, repeatV]: dashes run along the road's length
    for (const [w, d, x, z, ru, rv] of [
      [12, 600, l, 0, 1, 50],
      [600, 12, 0, l, 50, 1],
    ]) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat.clone());
      r.material.map = roadTex.clone();
      r.material.map.needsUpdate = true;
      r.material.map.repeat.set(ru, rv);
      r.rotation.x = -Math.PI / 2;
      r.position.set(x, 0.06, z);
      r.receiveShadow = true;
      group.add(r);
    }
  }

  // --- Buildings: one or two per block, varied height/colour/texture ---
  const facadeColors = ['#e8c9a0', '#d9a06b', '#c98f7a', '#a8b8c4', '#e0d6c2', '#b98a5e', '#8fa3b8', '#d6b48f'];
  const roofColors = ['#7a5a44', '#5e6b7a', '#8a6a4a', '#4a4a52'];
  let buildingCount = 0;
  const landmarkBlocks = new Set();
  // Keep landmark lots clear of random buildings. Block boundaries sit at
  // -262.5 + 75k, so a lot's block index is floor((coord + 262.5) / 75).
  for (const p of Object.values(PLACES)) {
    const bx = Math.floor((p.x + 262.5) / 75);
    const bz = Math.floor((p.z + 262.5) / 75);
    landmarkBlocks.add(`${bx},${bz}`);
  }
  for (let bi = 0; bi < 8; bi += 1) {
    for (let bj = 0; bj < 8; bj += 1) {
      if (landmarkBlocks.has(`${bi},${bj}`)) continue;
      const cx = -262.5 + bi * 75 + 37.5;
      const cz = -262.5 + bj * 75 + 37.5;
      if (cz > 210) continue; // beach row stays open
      const n = rng() < 0.45 ? 2 : 1;
      for (let k = 0; k < n; k += 1) {
        const w = range(rng, 16, 30);
        const d = range(rng, 16, 28);
        const h = range(rng, 10, 52) * (rng() < 0.12 ? 1.8 : 1);
        const x = cx + (n === 2 ? (k === 0 ? -14 : 14) : 0) + range(rng, -4, 4);
        const z = cz + range(rng, -6, 6);
        const color = pick(rng, facadeColors);
        const tex = buildingTexture(Math.floor(rng() * 1e9), color);
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        // flat roof cap
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
          new THREE.MeshLambertMaterial({ color: pick(rng, roofColors) }),
        );
        roof.position.set(x, h + 0.25, z);
        group.add(roof);
        // rooftop AC box on tall towers
        if (h > 30) {
          const ac = new THREE.Mesh(
            new THREE.BoxGeometry(3, 1.6, 2.4),
            new THREE.MeshLambertMaterial({ color: 0x9aa0a6 }),
          );
          ac.position.set(x + w * 0.2, h + 1.3, z);
          group.add(ac);
        }
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        buildingCount += 1;
      }
    }
  }

  // --- Landmark buildings: bank, casino, garage, safehouse, docks ---
  const lmDefs = [
    [PLACES.bank.x, PLACES.bank.z, 34, 22, 26, '#e8dcc0'],
    [PLACES.casino.x, PLACES.casino.z, 40, 26, 30, '#c94f6d'],
    [PLACES.garage.x, PLACES.garage.z, 26, 9, 20, '#7a6a58'],
    [PLACES.safehouse.x, PLACES.safehouse.z, 18, 12, 16, '#8fa3b8'],
    [PLACES.docks.x, PLACES.docks.z, 30, 14, 22, '#6b7a8a'],
  ];
  for (const [x, z, w, h, d, color] of lmDefs) {
    const tex = buildingTexture(Math.floor(rng() * 1e9), color);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ map: tex }));
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.5, d + 0.5), new THREE.MeshLambertMaterial({ color: 0x4a4a52 }));
    roof.position.set(x, h + 0.25, z);
    group.add(roof);
  }

  // --- Park: grass square + trees; plaza: pale stone disc ---
  const grassTex = grassTexture();
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(6, 6);
  const park = new THREE.Mesh(
    new THREE.PlaneGeometry(58, 58),
    new THREE.MeshLambertMaterial({ map: grassTex }),
  );
  park.rotation.x = -Math.PI / 2;
  park.position.set(PLACES.park.x, 0.08, PLACES.park.z);
  park.receiveShadow = true;
  group.add(park);

  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(26, 28),
    new THREE.MeshLambertMaterial({ color: 0xd8cfba }),
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.08, 0);
  plaza.receiveShadow = true;
  group.add(plaza);

  // --- Pier: wooden deck out into the ocean + yacht ---
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 52), pierMat);
  deck.position.set(0, 0.4, 306);
  deck.castShadow = true;
  group.add(deck);
  for (let i = 0; i < 5; i += 1) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3, 6), pierMat);
    post.position.set(i % 2 === 0 ? -4.6 : 4.6, 0.4, 288 + i * 9);
    group.add(post);
  }
  // yacht at the pier end
  const yacht = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 14), new THREE.MeshLambertMaterial({ color: 0xf2f0e8 }));
  hull.position.y = 0.8;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 6), new THREE.MeshLambertMaterial({ color: 0x2b6f8f }));
  cabin.position.set(0, 2.2, -1);
  yacht.add(hull, cabin);
  yacht.position.set(9, 0.2, 318);
  yacht.rotation.y = 0.3;
  group.add(yacht);

  // --- Palms: trunk + crossed frond planes, scattered on beach, park, plaza ---
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f7a3a, side: THREE.DoubleSide });
  function palm(x, z, s = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 6 * s, 6), trunkMat);
    trunk.position.y = 3 * s;
    trunk.rotation.z = (rng() - 0.5) * 0.2;
    trunk.castShadow = true;
    g.add(trunk);
    for (let i = 0; i < 6; i += 1) {
      const frond = new THREE.Mesh(new THREE.PlaneGeometry(3.4 * s, 0.9 * s), frondMat);
      const a = (i / 6) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.4 * s, 6.1 * s, Math.sin(a) * 1.4 * s);
      frond.rotation.set(Math.sin(a) * 0.9, a, Math.cos(a) * 0.9);
      frond.rotation.y = -a + Math.PI / 2;
      frond.rotation.x = -0.7;
      g.add(frond);
    }
    g.position.set(x, 0, z);
    group.add(g);
    return g;
  }
  for (let i = 0; i < 26; i += 1) palm(range(rng, -280, 280), range(rng, 240, 272), range(rng, 0.9, 1.3));
  for (let i = 0; i < 10; i += 1) palm(PLACES.park.x + range(rng, -24, 24), PLACES.park.z + range(rng, -24, 24));
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    palm(Math.cos(a) * 30, Math.sin(a) * 30, 1.1);
  }
  for (let i = 0; i < 8; i += 1) palm(range(rng, -280, 280), range(rng, -280, -240), 1);

  // --- Streetlights + traffic lights along roads ---
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2e3438 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const lightHeads = [];
  for (const l of ROAD_LINES) {
    for (let t = -225; t <= 225; t += 75) {
      for (const [x, z] of [[l + 8, t], [t, l + 8]]) {
        if (Math.abs(x) > 290 || Math.abs(z) > 290 || z > 230) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), poleMat);
        pole.position.set(x, 3.5, z);
        group.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.12), poleMat);
        arm.position.set(x - 1, 7, z);
        group.add(arm);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampMat);
        head.position.set(x - 2, 6.9, z);
        group.add(head);
        lightHeads.push(head);
      }
    }
  }
  // traffic lights at the plaza intersections
  const tlMats = [new THREE.MeshBasicMaterial({ color: 0x33cc55 }), new THREE.MeshBasicMaterial({ color: 0xffcc22 }), new THREE.MeshBasicMaterial({ color: 0xff3344 })];
  for (const [x, z] of [[-37.5, -37.5], [37.5, -37.5], [-37.5, 37.5], [37.5, 37.5]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 5.5, 6), poleMat);
    pole.position.set(x + 7, 2.75, z + 7);
    group.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), new THREE.MeshLambertMaterial({ color: 0x1c1e22 }));
    box.position.set(x + 7, 5.6, z + 7);
    group.add(box);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), tlMats[Math.floor(rng() * 3)]);
    lamp.position.set(x + 7, 6.1, z + 7.4);
    group.add(lamp);
  }

  // --- Smashable props: hydrants, crates, bins, cones near roads ---
  const propMats = {
    hydrant: new THREE.MeshLambertMaterial({ color: 0xc23a2e }),
    crate: new THREE.MeshLambertMaterial({ color: 0xa8824a }),
    bin: new THREE.MeshLambertMaterial({ color: 0x3a6b4a }),
    cone: new THREE.MeshLambertMaterial({ color: 0xe86a1a }),
  };
  for (let i = 0; i < 60; i += 1) {
    const kind = pick(rng, ['hydrant', 'crate', 'bin', 'cone']);
    const road = pick(rng, ROAD_LINES);
    const along = range(rng, -250, 250);
    const side = rng() < 0.5;
    const x = side ? road + 8.5 : along;
    const z = side ? along : road + 8.5;
    if (z > 232 || Math.abs(x) > 285) continue;
    let mesh;
    if (kind === 'hydrant') mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.9, 8), propMats.hydrant);
    else if (kind === 'crate') mesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), propMats.crate);
    else if (kind === 'bin') mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 1.1, 8), propMats.bin);
    else mesh = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 8), propMats.cone);
    mesh.position.set(x, kind === 'crate' ? 0.55 : 0.5, z);
    mesh.castShadow = true;
    group.add(mesh);
    props.push({ mesh, x, z, alive: true, kind });
  }

  // --- Sun-coins: spinning gold discs, 24 across the map ---
  const coinGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.12, 16);
  const coinMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  const coinSpots = [];
  for (let i = 0; i < SUN_COINS; i += 1) {
    const road = pick(rng, ROAD_LINES);
    const along = range(rng, -260, 260);
    const x = rng() < 0.5 ? road + range(rng, -4, 4) : along;
    const z = rng() < 0.5 ? along : road + range(rng, -4, 4);
    coinSpots.push([clamp(x, -285, 285), clamp(z, -285, 275)]);
  }
  // a few hand-placed: beach, pier, park, plaza, docks, casino roof approach
  coinSpots[0] = [0, 300];
  coinSpots[1] = [-150, 150];
  coinSpots[2] = [0, 0];
  coinSpots[3] = [240, 180];
  coinSpots[4] = [-260, 260];
  coinSpots.forEach(([x, z], idx) => {
    const mesh = new THREE.Mesh(coinGeo, coinMat);
    mesh.position.set(x, 1.2, z);
    mesh.rotation.x = Math.PI / 2;
    group.add(mesh);
    coins.push({ mesh, x, z, y: 1.2, idx, taken: false });
  });

  // --- Objective beacon: tall gold pillar, repositioned by missions.js ---
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd23e, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true), beaconMat);
  beacon.position.set(PLACES.garage.x, 30, PLACES.garage.z);
  group.add(beacon);

  return { group, colliders, props, coins, beacon, buildingCount, lightHeads };
}
