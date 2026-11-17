// SOLMAR — the city: 600x600 m grid, ~90 procedural buildings, beach + ocean,
// pier, park, plaza, palms, streetlights, traffic lights, props and colliders.
import * as THREE from 'three';
import { CITY, ROADS, BLOCK_CENTERS, PLACES, PALETTE } from './config.js';
import { createRandom, range, pick } from './random.js';
import { buildTextures } from './textures.js';

const SPECIAL_BLOCKS = {
  '0,0': 'plaza', '-75,75': 'park', '75,-75': 'bank', '225,-225': 'casino',
  '-225,-225': 'garage', '-225,225': 'safehouse',
};

export function createCity(scene, seed) {
  const rng = createRandom(seed ^ 0xc177);
  const tex = buildTextures(seed);
  const colliders = [];   // {x0,z0,x1,z1}
  const props = [];       // smashable props {mesh,x,z,alive}
  const coins = [];       // sun-coin meshes {mesh,x,z,taken}
  const markers = {};     // named marker meshes for the minimap / missions
  const group = new THREE.Group();
  scene.add(group);

  const addCollider = (x, z, hw, hd) => colliders.push({ x0: x - hw, z0: z - hd, x1: x + hw, z1: z + hd });

  // --- sky, sun, fog -------------------------------------------------------
  scene.background = new THREE.Color(0xffc98a);
  scene.fog = new THREE.Fog(0xf2b878, 120, 620);
  const hemi = new THREE.HemisphereLight(0xffe0b0, 0x4a5560, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd27a, 2.4);
  sun.position.set(-180, 140, 260); // low golden sun over the ocean (south-west)
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -320; sun.shadow.camera.right = 320;
  sun.shadow.camera.top = 320; sun.shadow.camera.bottom = -320;
  sun.shadow.camera.far = 900;
  scene.add(sun);
  scene.add(sun.target);

  // sky gradient dome (big inverted sphere, vertex colours via canvas texture)
  const skyGeo = new THREE.SphereGeometry(900, 24, 12);
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false });
  const skyCanvas = document.createElement('canvas'); skyCanvas.width = 4; skyCanvas.height = 256;
  const sg = skyCanvas.getContext('2d');
  const grad = sg.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2f6fb8'); grad.addColorStop(0.45, '#7fb2dd');
  grad.addColorStop(0.7, '#ffc98a'); grad.addColorStop(1, '#ff9a5a');
  sg.fillStyle = grad; sg.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  skyMat.map = skyTex;
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  // sun disc glow
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2c8, fog: false, transparent: true, opacity: 0.95 }));
  sunDisc.position.set(-420, 150, 620); sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);

  // --- ground: grass base, roads, sidewalks, sand, ocean -------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const roadMatH = new THREE.MeshLambertMaterial({ map: tex.roadH });
  tex.roadH.repeat.set(16, 1);
  const roadMatV = new THREE.MeshLambertMaterial({ map: tex.roadV });
  tex.roadV.repeat.set(1, 16);
  const walkMat = new THREE.MeshLambertMaterial({ map: tex.sidewalk });
  const roadGeoH = new THREE.PlaneGeometry(620, CITY.ROAD_WIDTH);
  const roadGeoV = new THREE.PlaneGeometry(CITY.ROAD_WIDTH, 620);
  for (const r of ROADS) {
    const rh = new THREE.Mesh(roadGeoH, roadMatH); rh.rotation.x = -Math.PI / 2; rh.position.set(0, 0.02, r); rh.receiveShadow = true; group.add(rh);
    const rv = new THREE.Mesh(roadGeoV, roadMatV); rv.rotation.x = -Math.PI / 2; rv.position.set(r, 0.02, 0); rv.receiveShadow = true; group.add(rv);
  }
  // sidewalk strips along every road (two thin planes per road, offset)
  for (const r of ROADS) {
    for (const off of [-9.5, 9.5]) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(620, 5), walkMat);
      sh.rotation.x = -Math.PI / 2; sh.position.set(0, 0.03, r + off); group.add(sh);
      const sv = new THREE.Mesh(new THREE.PlaneGeometry(5, 620), walkMat);
      sv.rotation.x = -Math.PI / 2; sv.position.set(r + off, 0.03, 0); group.add(sv);
    }
  }
  // beach + ocean (south edge)
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(640, 40), new THREE.MeshLambertMaterial({ map: tex.sand }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.04, 282); sand.receiveShadow = true; group.add(sand);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1400, 500), new THREE.MeshLambertMaterial({ map: tex.ocean }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, 0.0, 550); group.add(ocean);
  // pier deck into the ocean
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 70), pierMat);
  pier.position.set(0, 0.8, 330); pier.castShadow = true; pier.receiveShadow = true; group.add(pier);
  for (let z = 305; z <= 360; z += 14) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 6), pierMat);
    post.position.set(z % 28 === 0 ? -4 : 4, 0, z); group.add(post);
  }
  // yacht at the pier end (mission 6 escape target)
  const yacht = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 2.4, 20), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  hull.position.y = 1.4; yacht.add(hull);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 10), new THREE.MeshLambertMaterial({ color: 0x2a4a6a }));
  cabin.position.y = 3.4; yacht.add(cabin);
  yacht.position.set(12, 0.4, 348); yacht.rotation.y = 0.3;
  group.add(yacht);

  // --- buildings -----------------------------------------------------------
  const facadeMats = tex.buildings.map((t) => new THREE.MeshLambertMaterial({ map: t }));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x2a4a6a });
  let buildingCount = 0;
  const bankMat = new THREE.MeshLambertMaterial({ color: 0xd8d0c0 });
  const casinoMat = new THREE.MeshLambertMaterial({ color: 0x8a2a4a });

  function addBuilding(cx, cz, w, d, h, mat, signTex) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(cx, h / 2, cz); m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), roofMat);
    roof.position.set(cx, h + 0.4, cz); group.add(roof);
    if (signTex) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5),
        new THREE.MeshBasicMaterial({ map: signTex }));
      sign.position.set(cx, Math.min(h - 2, 14), cz + d / 2 + 0.3);
      group.add(sign);
    }
    addCollider(cx, cz, w / 2 + 0.5, d / 2 + 0.5);
    buildingCount++;
  }

  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      const key = `${bx},${bz}`;
      const special = SPECIAL_BLOCKS[key];
      if (special === 'plaza') {
        // Solmar Plaza: fountain + open paving
        const pave = new THREE.Mesh(new THREE.CircleGeometry(24, 24), new THREE.MeshLambertMaterial({ color: 0xc8b890 }));
        pave.rotation.x = -Math.PI / 2; pave.position.set(0, 0.05, 0); pave.receiveShadow = true; group.add(pave);
        const fountain = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 1.6, 20), new THREE.MeshLambertMaterial({ color: 0x8ab8d0 }));
        fountain.position.set(0, 0.8, 0); fountain.castShadow = true; group.add(fountain);
        const water = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.4, 20), new THREE.MeshLambertMaterial({ color: 0x3a9ac8 }));
        water.position.set(0, 1.7, 0); group.add(water);
        addCollider(0, 0, 7, 7);
        continue;
      }
      if (special === 'park') {
        const lawn = new THREE.Mesh(new THREE.CircleGeometry(22, 20), new THREE.MeshLambertMaterial({ color: 0x3f7a3a }));
        lawn.rotation.x = -Math.PI / 2; lawn.position.set(bx, 0.05, bz); group.add(lawn);
        continue; // palms planted below by the park scatter
      }
      if (special === 'bank') { addBuilding(bx, bz, 34, 22, 16, bankMat, tex.signBank); markers.bank = { x: bx, z: bz }; continue; }
      if (special === 'casino') { addBuilding(bx, bz, 40, 26, 20, casinoMat, tex.signCasino); markers.casino = { x: bx, z: bz }; continue; }
      if (special === 'garage') {
        addBuilding(bx, bz, 30, 20, 9, new THREE.MeshLambertMaterial({ color: 0x6a5a4a }), tex.signGarage);
        markers.garage = { x: bx, z: bz }; continue;
      }
      if (special === 'safehouse') {
        addBuilding(bx, bz, 16, 14, 8, new THREE.MeshLambertMaterial({ color: 0xd8b878 }), null);
        markers.safehouse = { x: bx, z: bz }; continue;
      }
      // ordinary block: 1 tall tower or 4 small shops
      if (rng() < 0.42) {
        const h = range(rng, 22, 55);
        addBuilding(bx, bz, range(rng, 20, 28), range(rng, 20, 28), h, pick(rng, facadeMats), null);
      } else {
        for (const [ox, oz] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) {
          const h = range(rng, 6, 14);
          addBuilding(bx + ox, bz + oz, range(rng, 14, 20), range(rng, 12, 18), h, pick(rng, facadeMats), null);
        }
      }
    }
  }

  // --- palms, streetlights, traffic lights, props --------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.trunk });
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palm });
  function addPalm(x, z, s = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.45 * s, 7 * s, 6), trunkMat);
    trunk.position.y = 3.5 * s; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 3.4 * s, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.4 * s, 7 * s, Math.sin(a) * 1.4 * s);
      leaf.rotation.z = Math.cos(a) * 1.1; leaf.rotation.x = -Math.sin(a) * 1.1;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    group.add(g);
    addCollider(x, z, 0.6, 0.6);
    return g;
  }
  // beach palms + park palms + plaza palms
  for (let x = -280; x <= 280; x += 28) { if (Math.abs(x) > 12) addPalm(x + range(rng, -4, 4), 276 + range(rng, -3, 3), range(rng, 0.9, 1.3)); }
  for (let i = 0; i < 14; i++) addPalm(-75 + range(rng, -18, 18), 75 + range(rng, -18, 18), range(rng, 0.9, 1.2));
  for (let i = 0; i < 8; i++) addPalm(range(rng, -26, 26), range(rng, -26, 26), range(rng, 0.9, 1.2));
  for (const r of ROADS) for (const c of [-240, -120, 0, 120, 240]) {
    if (rng() < 0.5) addPalm(r + 11, c, 0.9);
  }

  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  function addStreetlight(x, z) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6), poleMat);
    pole.position.set(x, 3.5, z); pole.castShadow = true; group.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
    head.position.set(x, 7, z); group.add(head);
    addCollider(x, z, 0.3, 0.3);
  }
  for (const r of ROADS) for (const c of ROADS) { addStreetlight(r + 8.5, c + 8.5); }

  // traffic lights at the four central intersections
  const tlGroup = new THREE.Group();
  for (const [ix, iz] of [[-37.5, -37.5], [37.5, -37.5], [-37.5, 37.5], [37.5, 37.5]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 5.5, 6), poleMat);
    pole.position.set(ix + 8, 2.75, iz + 8); tlGroup.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    box.position.set(ix + 8, 5.6, iz + 8); tlGroup.add(box);
    for (let i = 0; i < 3; i++) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6),
        new THREE.MeshBasicMaterial({ color: i === 0 ? 0xff4444 : i === 1 ? 0xffcc22 : 0x44ff66 }));
      lamp.position.set(ix + 8, 6.1 - i * 0.55, iz + 8.4); tlGroup.add(lamp);
    }
  }
  group.add(tlGroup);

  // smashable props: crates, bins, hydrants, cones (Rampage targets)
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xa87830 });
  const binMat = new THREE.MeshLambertMaterial({ color: 0x3a6a4a });
  const coneMat = new THREE.MeshLambertMaterial({ color: 0xe86a20 });
  for (let i = 0; i < 40; i++) {
    const x = range(rng, -260, 260), z = range(rng, -260, 260);
    if (Math.abs(x) < 30 && Math.abs(z) < 30) continue; // keep plaza clear
    const kind = i % 3;
    const mesh = kind === 0
      ? new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), crateMat)
      : kind === 1
        ? new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 10), binMat)
        : new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 8), coneMat);
    mesh.position.set(x, kind === 0 ? 0.7 : 0.6, z);
    mesh.castShadow = true;
    group.add(mesh);
    props.push({ mesh, x, z, alive: true });
    addCollider(x, z, 0.8, 0.8);
  }

  // sun-coins: 24 golden rings scattered across the city
  const coinGeo = new THREE.TorusGeometry(0.7, 0.28, 8, 18);
  const coinMat = new THREE.MeshLambertMaterial({ color: 0xffd75e, emissive: 0x8a6a00 });
  const coinSpots = [];
  for (let i = 0; i < 24; i++) {
    const x = range(rng, -260, 260), z = range(rng, -255, 255);
    coinSpots.push([x, z]);
  }
  // force a few onto the beach / plaza / pier for the screenshots' variety
  coinSpots[0] = [24, 18]; coinSpots[1] = [120, 275]; coinSpots[2] = [-120, 275]; coinSpots[3] = [0, 320];
  for (const [x, z] of coinSpots) {
    const mesh = new THREE.Mesh(coinGeo, coinMat);
    mesh.position.set(x, 1.4, z);
    group.add(mesh);
    coins.push({ mesh, x, z, taken: false, phase: rng() * Math.PI * 2 });
  }

  // mission marker beacons (tall glowing pillars, toggled by missions.js)
  function addBeacon(key, x, z, color) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    mesh.position.set(x, 30, z); mesh.visible = false; group.add(mesh);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.2, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.12, z); ring.visible = false; group.add(ring);
    markers[key] = { x, z, beacon: mesh, ring };
  }
  addBeacon('mission', 0, 0, 0xffd75e);
  addBeacon('taxi', PLACES.taxiStand.x, PLACES.taxiStand.z, 0x3fa7ff);
  addBeacon('courier', PLACES.docks.x, PLACES.docks.z, 0x7ef0a8);
  addBeacon('rampage', PLACES.park.x, PLACES.park.z, 0xff7a5a);

  return {
    group, colliders, props, coins, markers, tex, buildingCount,
    sun, sky,
    // circle-vs-AABB collision: returns true if (x,z) with radius r hits anything
    hits(x, z, r) {
      for (const c of colliders) {
        const cx = Math.max(c.x0, Math.min(x, c.x1));
        const cz = Math.max(c.z0, Math.min(z, c.z1));
        const dx = x - cx, dz = z - cz;
        if (dx * dx + dz * dz < r * r) return true;
      }
      return false;
    },
    // push a circle out of colliders (simple axis-separated resolve)
    resolve(x, z, r) {
      for (const c of colliders) {
        const cx = Math.max(c.x0, Math.min(x, c.x1));
        const cz = Math.max(c.z0, Math.min(z, c.z1));
        const dx = x - cx, dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (r - d) / d;
          x += dx * push; z += dz * push;
        } else if (d2 <= 1e-6 && x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) {
          // centre inside the box: push out along the smallest penetration axis
          const pl = x - (c.x0 - r), pr = (c.x1 + r) - x, pt = z - (c.z0 - r), pb = (c.z1 + r) - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.x0 - r; else if (m === pr) x = c.x1 + r;
          else if (m === pt) z = c.z0 - r; else z = c.z1 + r;
        }
      }
      return [x, z];
    },
  };
}
