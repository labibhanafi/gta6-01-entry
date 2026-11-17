// SOLMAR — boot, fixed 60 Hz sim loop, third-person camera, title/pause/
// game-over flow, and the deterministic ?shot= screenshot scenes.
// Presentation (camera, HUD sync) never feeds back into the simulation.
import * as THREE from 'three';
import { CITY, PLACES, SUN_COINS, WEAPONS } from './config.js';
import { mulberry32, clamp } from './random.js';
import { createState, saveGame, loadGame, applySave, hasSave } from './state.js';
import { buildCity } from './city.js';
import { createVehicle, spawnTraffic, spawnParked, driveVehicle, updateTraffic, collideCircle } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { Police, addWanted as policeAddWanted } from './police.js';
import { MissionSys } from './missions.js';
import { Combat, explodeVehicle } from './combat.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { Effects } from './effects.js';
import { createPlayer, updatePlayer, enterVehicle } from './player.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = shot ? (Number.parseInt(params.get('seed') ?? '1', 10) || 1) : (Date.now() % 2147483647);
const FIXED = 1 / 60;

const state = createState();
const input = new Input(document.querySelector('#game canvas') || document.body);
const audio = new AudioSys();
const hud = new HUD();

// --- Renderer / scene / light ---
const container = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);
renderer.domElement.addEventListener('click', () => {
  if (document.pointerLockElement !== renderer.domElement) {
    try { renderer.domElement.requestPointerLock(); } catch { /* drag fallback */ }
  }
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc0e0);
scene.fog = new THREE.Fog(0xf2c98d, 120, 520);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(-240, 30, -240);

const hemi = new THREE.HemisphereLight(0xffe8c0, 0x5a4a3a, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe3b0, 2.1);
sun.position.set(-180, 220, 120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -320;
sun.shadow.camera.right = 320;
sun.shadow.camera.top = 320;
sun.shadow.camera.bottom = -320;
sun.shadow.camera.far = 700;
scene.add(sun);
// low golden sun disc in the sky, toward the ocean (south-west)
const sunBall = new THREE.Mesh(
  new THREE.CircleGeometry(26, 24),
  new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: false }),
);
sunBall.position.set(-260, 95, 420);
sunBall.lookAt(camera.position);
scene.add(sunBall);

// --- World build ---
const city = buildCity(scene, seed);
const player = createPlayer(scene);
const fx = new Effects(scene);
const police = new Police(scene);
const missions = new MissionSys(scene);
const combat = new Combat();
const traffic = spawnTraffic(scene, seed, 12);
const parked = spawnParked(scene, seed, 10);
const peds = spawnPeds(scene, seed, 24);
const vehicles = [...traffic, ...parked];

// The shared world object every system reads.
const W = {
  scene, camera, renderer, state, input, audio, fx, hud, city, player,
  vehicles, traffic, parked, peds, police, missions, combat,
  time: 0,
  beaconPos: { x: PLACES.garage.x, z: PLACES.garage.z },
  nearCar: null,
  vehicleFns: { driveVehicle },
  combatFns: { explodeVehicle },
  save: () => saveGame(state),
  setBeacon: (place) => {
    if (!place) {
      W.beaconPos = null;
      city.beacon.visible = false;
      return;
    }
    W.beaconPos = { x: place.x, z: place.z };
    city.beacon.visible = true;
    city.beacon.position.set(place.x, 30, place.z);
  },
  addWanted: (n) => policeAddWanted(state, n, fx, audio),
  onBusted: () => endRun('busted'),
  onKill: (t) => {
    if (t.isCop) hud.feed('Cop down — the whole force is coming now.');
  },
};
missions.stateIdx = 0;

function endRun(kind) {
  if (state.over) return;
  state.over = true;
  state.overKind = kind;
  state.paused = false;
  const fine = kind === 'busted' ? Math.min(state.cash, 150) : Math.floor(state.cash * 0.1);
  state.cash -= fine;
  const title = document.getElementById('final-title');
  const sub = document.getElementById('final-sub');
  if (kind === 'busted') {
    title.textContent = 'BUSTED';
    sub.textContent = `The Solmar PD hauled you in. Bail cost $${fine}. Your car is impounded — walk it off, Mara.`;
  } else {
    title.textContent = 'WASTED';
    sub.textContent = `You woke up at Solmar General, $${fine} lighter. Eddie says the jobs are still waiting.`;
  }
  document.getElementById('gameover').hidden = false;
  if (audio) audio.fail();
  saveGame(state);
}

function respawn() {
  state.over = false;
  state.overKind = null;
  state.hp = 100;
  state.wanted = 0;
  police.clear();
  if (player.vehicle) {
    player.vehicle.driver = 'none';
    player.vehicle = null;
  }
  player.mesh.visible = true;
  player.pos.set(PLACES.safehouse.x, 0, PLACES.safehouse.z + 14);
  player.yaw = 0;
  player.camYaw = 0;
  document.getElementById('gameover').hidden = true;
  hud.feed('Back on the streets. Stay sharp.');
}

function startGame(fresh) {
  const menu = document.getElementById('menu');
  menu.hidden = true;
  document.getElementById('pause').hidden = true;
  document.getElementById('gameover').hidden = true;
  if (fresh) {
    const keepMuted = state.muted;
    Object.assign(state, createState());
    state.muted = keepMuted;
    state.started = true;
  } else {
    const save = loadGame();
    if (save) applySave(state, save);
    state.started = true;
  }
  state.paused = false;
  state.over = false;
  state.hp = 100;
  // Spawn on the street by the safehouse; the menu backdrop leaves the
  // player posed at the plaza, which is not a start position.
  player.pos.set(PLACES.safehouse.x, 0, PLACES.safehouse.z + 14);
  player.yaw = 0;
  player.camYaw = 0;
  missions.setMission(W, state.missionIdx, 0);
  audio.ensure();
  audio.setMuted(state.muted);
  hud.feed("Eddie Marlow: steal a car, bring it to my garage. Don't get cute.");
  saveGame(state);
}

document.getElementById('play-btn').addEventListener('click', () => startGame(true));
document.getElementById('continue-btn').addEventListener('click', () => startGame(false));
document.getElementById('resume-btn').addEventListener('click', () => {
  state.paused = false;
  document.getElementById('pause').hidden = true;
});
document.getElementById('quit-btn').addEventListener('click', () => {
  saveGame(state);
  state.started = false;
  state.paused = false;
  document.getElementById('pause').hidden = true;
  document.getElementById('menu').hidden = false;
  refreshContinue();
});
document.getElementById('again-btn').addEventListener('click', respawn);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && !state.started && !shot) startGame(hasSave());
  if ((e.code === 'Escape' || e.code === 'KeyP') && state.started && !state.over && !shot) {
    state.paused = !state.paused;
    document.getElementById('pause').hidden = !state.paused;
    if (state.paused) saveGame(state);
  }
});

function refreshContinue() {
  const btn = document.getElementById('continue-btn');
  btn.hidden = !hasSave();
}
refreshContinue();

// --- Simulation step (fixed 60 Hz) ---
let saveT = 0;

function stepSim(dt) {
  W.time += dt;
  state.playTime += dt;
  if (!state.started || state.paused || state.over) return;

  updatePlayer(dt, W);
  combat.update(dt, W);

  // traffic + mission courier drive the grid
  for (const v of traffic) {
    if (!v.dead) updateTraffic(v, dt, city.colliders, vehicles, fx);
  }
  if (missions.courier && !missions.courier.dead) {
    updateTraffic(missions.courier, dt, city.colliders, vehicles, fx);
  }
  // parked cars sit still; cruisers are driven by police.update
  updatePeds(peds, dt, gunfireDanger(), W.time);
  police.update(dt, W);
  missions.update(dt, W);

  // sun-coins spin
  for (const c of city.coins) {
    if (!c.taken) c.mesh.rotation.y += dt * 2.4;
  }
  // car fires: wrecked traffic cars explode
  for (const v of vehicles) {
    if (!v.dead && v.hp <= 0) explodeVehicle(W, v);
  }
  // player death
  if (state.hp <= 0) endRun('wasted');

  // audio + autosave
  const speedNorm = player.vehicle ? Math.abs(player.vehicle.speed) / 46 : 0;
  audio.update(dt, speedNorm, state.wanted, true);
  saveT += dt;
  if (saveT > 12) {
    saveT = 0;
    saveGame(state);
  }
}

function gunfireDanger() {
  if (W.time - combat.lastShotAt < 0.25) {
    return { x: player.pos.x, z: player.pos.z, r: 42 };
  }
  return null;
}

// --- Camera + presentation ---
let lastMouseT = 0;
function syncPresentation(dt) {
  const p = player;
  // ease the orbit behind the car while driving and the mouse is idle
  if (p.vehicle && W.time - (W.lastMouseT || 0) > 1.2) {
    let target = p.yaw;
    let d = target - p.camYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    p.camYaw += d * Math.min(1, dt * 1.6);
  }
  const dist = (p.camMode === 0 ? 8.5 : p.camMode === 1 ? 13 : 20) * (p.vehicle ? 1.4 : 1);
  const height = p.camMode === 2 ? 16 : 3.2 + p.camPitch * 4;
  const cx = p.pos.x - Math.sin(p.camYaw) * Math.cos(p.camPitch) * dist;
  const cz = p.pos.z - Math.cos(p.camYaw) * Math.cos(p.camPitch) * dist;
  const cy = p.pos.y + height + Math.sin(p.camPitch) * dist * 0.4;
  const sh = fx.shakeOffset();
  camera.position.set(cx + sh.x, cy + sh.y, cz);
  camera.lookAt(p.pos.x, p.pos.y + 1.6, p.pos.z);
  // player faces the camera orbit when on foot; aim yaw follows the camera
  // so shooting goes where you look (forward = (sin camYaw, cos camYaw)).
  if (!p.vehicle) {
    p.yaw = p.camYaw;
  }
  fx.update(dt);
  hud.update(dt, W);
  sunBall.lookAt(camera.position);
}

// --- Main loop ---
let accumulator = 0;
let lastT = performance.now();
let frozen = false;

function frame(now) {
  if (frozen) return;
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  if (state.started && !state.paused && !state.over) {
    accumulator += dt;
    let n = 0;
    while (accumulator >= FIXED && n < 5) {
      stepSim(FIXED);
      accumulator -= FIXED;
      n += 1;
    }
    if (accumulator > FIXED * 5) accumulator = 0;
  }
  if (input.mouseDX !== 0 || input.mouseDY !== 0) lastMouseT = W.time;
  void lastMouseT;
  syncPresentation(dt);
  renderer.render(scene, camera);
  input.endFrame();
}

// --- Screenshot scenes: deterministic poses from the game's own systems. ---
function settle(steps) {
  for (let i = 0; i < steps; i += 1) stepSim(FIXED);
}

function giveCar(type, x, z, yaw, speed = 0) {
  const v = createVehicle(scene, type, x, z, yaw, { driver: 'player' });
  v.speed = speed;
  vehicles.push(v);
  player.vehicle = v;
  player.mesh.visible = false;
  player.pos.set(x, 0, z);
  player.yaw = yaw;
  player.camYaw = yaw; // camera sits behind the car: camYaw == car yaw
  return v;
}

function runShot(name) {
  document.getElementById('menu').hidden = true;
  state.started = true;
  state.hp = 100;
  state.cash = 1840;
  state.coins = 7;
  missions.setMission(W, 3, 1);
  state.missionText = '4. Heat Wave — lose the cops and reach the Safehouse';
  const bannerKeep = missions.bannerText;
  void bannerKeep;

  if (name === 'chase') {
    // COVER: Vento GT at speed, 3 stars, 2 cruisers behind, traffic ahead.
    state.wanted = 3;
    giveCar('vento', 37.5, -70, 0, 34);
    const c1 = police.spawnCruiser(33, -77);
    c1.yaw = 0;
    c1.speed = 30;
    const c2 = police.spawnCruiser(42, -82);
    c2.yaw = 0;
    c2.speed = 28;
    traffic[0].x = 37.5; traffic[0].z = -18; traffic[0].yaw = 0; traffic[0].speed = 12;
    traffic[1].x = 33; traffic[1].z = 6; traffic[1].yaw = 0; traffic[1].speed = 11;
    traffic[2].x = -37.5; traffic[2].z = -30; traffic[2].yaw = Math.PI; traffic[2].speed = 10;
    state.missionText = '4. Heat Wave — lose the cops and reach the Safehouse';
    missions.bannerText = 'MISSION 4: HEAT WAVE';
    missions.bannerT = 99;
    player.camMode = 1; // pull back so the pursuing cruisers stay in frame
    player.camYaw = 0;
    player.camPitch = 0.3;
    settle(10);
  } else if (name === 'street') {
    // On foot in the plaza at golden hour, peds, parked cars, palms, ocean glimpse.
    state.wanted = 0;
    player.pos.set(0, 0, -6);
    player.yaw = 0;
    player.camYaw = 0; // camera north of the player, looking south to the ocean
    player.camPitch = 0.28;
    // gather a few pedestrians near the plaza
    peds.slice(0, 8).forEach((p, i) => {
      const a = (i / 8) * Math.PI * 2;
      p.x = Math.cos(a) * 14;
      p.z = Math.sin(a) * 14 + 4;
      p.mesh.position.set(p.x, 0, p.z);
    });
    parked[0].x = 12; parked[0].z = -14; parked[0].mesh.position.set(12, 0, -14);
    parked[1].x = -14; parked[1].z = 10; parked[1].mesh.position.set(-14, 0, 10);
    state.missionText = '1. First Wheels — steal any car (walk up, press F)';
    missions.bannerText = '';
    missions.bannerT = 0;
    settle(6);
  } else if (name === 'mission') {
    // Meridian Bank shootout: pistol out, muzzle flash, guard + cop, stars visible.
    state.wanted = 3;
    state.weapon = 'pistol';
    state.weapons.pistol = true;
    state.mag.pistol = 12;
    state.ammo.pistol = 48;
    // Stand on the road south of the bank (bank front face is z=24), facing it.
    player.pos.set(PLACES.bank.x, 0, PLACES.bank.z - 29);
    player.yaw = 0;
    player.camYaw = 0;
    player.camPitch = 0.22;
    missions.spawnGuards(W, PLACES.bank.x, PLACES.bank.z - 16, 2, 0x3a2f2f);
    const cop = police.spawnFootCop(PLACES.bank.x + 7, PLACES.bank.z - 14);
    cop.x = PLACES.bank.x + 7;
    cop.z = PLACES.bank.z - 14;
    state.missionText = '5. Meridian Job — hold at the bank to grab the cash!';
    missions.bannerText = 'MISSION 5: MERIDIAN JOB';
    missions.bannerT = 99;
    settle(4);
    // fire at the nearest guard for a live muzzle flash
    const targets = [...missions.guards.filter((g) => g.alive)];
    combat.tryFire(W, targets);
    settle(2);
  } else if (name === 'drive') {
    // High-speed boulevard run toward the beach and ocean, sun glare.
    state.wanted = 1;
    giveCar('vento', 37.5, 150, 0, 42);
    traffic[3].x = 37.5; traffic[3].z = 205; traffic[3].yaw = 0; traffic[3].speed = 12;
    traffic[4].x = 33; traffic[4].z = 225; traffic[4].yaw = 0; traffic[4].speed = 11;
    traffic[5].x = -37.5; traffic[5].z = 195; traffic[5].yaw = Math.PI; traffic[5].speed = 10;
    state.missionText = 'Free roam — the beach road is calling. Sun-coins: 7/24';
    missions.bannerText = '';
    missions.bannerT = 0;
    player.camYaw = 0;
    player.camPitch = 0.26;
    settle(8);
  }
  syncPresentation(0.016);
  hud.update(0.016, W);
  let painted = 0;
  function paint() {
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
      return;
    }
    requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__solmar = { state, W, startGame, respawn };
if (shot) runShot(shot);
else {
  // Menu backdrop: a slow orbit over the plaza so the title screen lives.
  player.pos.set(0, 0, 0);
  player.camYaw = 0.6;
  requestAnimationFrame(frame);
}
