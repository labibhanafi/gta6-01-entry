// SOLMAR — boot and the one loop. A fixed 60 Hz simulation (player, cars,
// traffic, peds, police, combat, missions) feeds a render at display rate;
// the camera and HUD are presentation and never feed the simulation.
// ?shot=chase|street|mission|drive&seed=N stages a scene with the game's own
// systems, renders it twice, sets window.__shotReady and freezes.
import * as THREE from 'three';
import { createState, saveGame, loadGame, applySave } from './state.js';
import { createCity } from './city.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createEffects } from './effects.js';
import { createPlayer } from './player.js';
import { WEAPONS, PLACES } from './config.js';

const FIXED = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : (Date.now() % 2147483647);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 1600);
camera.rotation.order = 'YXZ';
scene.add(camera);

const state = createState(seed);
const city = createCity(scene, seed);
const vehicles = createVehicles(scene, city, seed);
const pedestrians = createPedestrians(scene, city, seed);
const police = createPolice(scene, city, seed);
const missions = createMissions();
const combat = createCombat(scene, seed);
const audio = createAudio();
const input = createInput(renderer.domElement);
const hud = createHud(state);
const fx = createEffects(scene, camera);
const player = createPlayer(scene);

// The shared game context every system reads from — no module imports another.
const G = {
  state, scene, camera, renderer, city, vehicles, pedestrians, police,
  missions, combat, audio, input, hud, fx, player,
  ui: null, // wired below (overlay helpers)
};

const titleEl = document.getElementById('title');
const pauseEl = document.getElementById('pause');
const overEl = document.getElementById('over');
const startBtn = document.getElementById('start-btn');
const continueBtn = document.getElementById('continue-btn');
const resumeBtn = document.getElementById('resume-btn');
const retryBtn = document.getElementById('retry-btn');
const saveNote = document.getElementById('save-note');

G.ui = {
  showOver(title, text) {
    document.getElementById('over-title').textContent = title;
    document.getElementById('over-text').textContent = text;
    overEl.style.display = 'flex';
    hud.hide();
  },
  hideOver() { overEl.style.display = 'none'; hud.show(); },
};

function showTitle() {
  titleEl.style.display = 'flex';
  pauseEl.style.display = 'none';
  overEl.style.display = 'none';
  hud.hide();
}

function startFresh() {
  audio.unlock();
  titleEl.style.display = 'none';
  state.screen = 'play';
  state.started = true;
  state.player.x = 0; state.player.z = 40; state.player.yaw = Math.PI;
  hud.show();
  hud.announce('SOLMAR. Mission 1: First Wheels. Steal any car.');
  if (state.missionIndex === 0 && !state.missionDone[0]) missions.startMission(G, 0);
  else hud.banner('SOLMAR', 'Back on the streets. The job is still on.');
  saveGame(state);
}

function continueGame() {
  const data = loadGame();
  if (data) applySave(state, data);
  startFresh();
}

startBtn.addEventListener('click', startFresh);
continueBtn.addEventListener('click', continueGame);
resumeBtn.addEventListener('click', () => {
  state.screen = 'play';
  pauseEl.style.display = 'none';
  hud.show();
});
retryBtn.addEventListener('click', () => {
  overEl.style.display = 'none';
  state.screen = 'play';
  state.health = 100;
  hud.show();
  hud.toast('Back on the streets. Stay sharp, Mara.');
  saveGame(state);
});

const saved = loadGame();
if (saved) {
  continueBtn.style.display = 'inline-block';
  saveNote.textContent = `Save found — $${(saved.cash ?? 0).toLocaleString('en-US')}, mission ${(saved.missionIndex ?? 0) + 1}/6, ${saved.coins ?? 0}/24 sun-coins.`;
}

// Enter starts from the title, Esc/P pauses and resumes — handled here because
// the fixed-step loop only runs while playing.
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && state.screen === 'title') startFresh();
  else if ((e.code === 'Escape' || e.code === 'KeyP') && (state.screen === 'play' || state.screen === 'paused')) {
    setPaused(state.screen === 'play');
  }
});

function setPaused(paused) {
  if (state.screen === 'play' && paused) {
    state.screen = 'paused';
    pauseEl.style.display = 'flex';
    hud.hide();
  } else if (state.screen === 'paused' && !paused) {
    state.screen = 'play';
    pauseEl.style.display = 'none';
    hud.show();
  }
}

// --- camera: third person, orbit with the mouse, closer in a car -----------
function updateCamera(dt) {
  const p = state.player;
  const mouse = input.takeMouse();
  state.camYaw -= mouse.dx * 0.0042;
  state.camPitch = Math.max(-0.15, Math.min(0.85, state.camPitch + mouse.dy * 0.0032));
  const dist = state.camDist;
  const height = 2.2 + state.camPitch * 7 + (p.inCar ? 1.6 : 0);
  const cx = p.x + Math.sin(state.camYaw) * dist;
  const cz = p.z + Math.cos(state.camYaw) * dist;
  const tx = p.x, ty = p.y + 1.8, tz = p.z;
  camera.position.set(cx, height + p.y * 0.5, cz);
  camera.lookAt(tx, ty, tz);
  // keep the camera out of buildings is skipped: the city is open enough
  // that the orbit stays above the roofs at this height on the roads.
}

// --- one fixed simulation step ----------------------------------------------
let prevFiring = false;
let lastSave = 0;
function stepSim(dt) {
  state.time += dt;
  const actions = input.takeActions();
  if (actions.pause) setPaused(state.screen === 'play');
  if (state.screen !== 'play') return;

  if (actions.mute) { state.muted = !state.muted; audio.setMuted(state.muted); hud.toast(state.muted ? 'Sound muted (M)' : 'Sound on (M)'); }
  if (actions.camera) state.camDist = state.camDist === 9 ? 6 : state.camDist === 6 ? 13 : 9;
  if (actions.steal) player.tryEnterCar(G);
  if (actions.interact) missions.tryInteract(G);
  if (actions.reload && state.weapon !== 'fists' && state.reloading <= 0 && state.mag[state.weapon] < WEAPONS[state.weapon].mag && state.ammo[state.weapon] > 0) {
    state.reloading = WEAPONS[state.weapon].reload;
    audio.reload();
  }
  const weaponKeys = { weapon1: 'fists', weapon2: 'pistol', weapon3: 'smg', weapon4: 'shotgun' };
  for (const [key, id] of Object.entries(weaponKeys)) {
    if (actions[key] && state.weaponsOwned[id]) {
      state.weapon = id; state.reloading = 0;
      hud.toast(`${WEAPONS[id].name} equipped`);
      audio.click();
    } else if (actions[key] && !state.weaponsOwned[id]) {
      hud.toast(`${WEAPONS[id].name} — buy it at Marlow's Gun Locker ($${WEAPONS[id].price})`);
    }
  }

  // shooting: semi-auto fires on click edge, SMG holds
  const firing = input.firing;
  if (!state.player.inCar) {
    if (firing && (WEAPONS[state.weapon].auto || !prevFiring)) combat.tryFire(G);
  }
  prevFiring = firing;

  player.step(dt, G);
  vehicles.step(dt, G);
  pedestrians.step(dt, G);
  police.step(dt, G);
  combat.step(dt, G);
  missions.update(dt, G);
  fx.step(dt);

  // prompt line (nearest interactable)
  hud.setPrompt(missions.promptFor(G));

  // engine + siren + music follow the live state
  const car = state.player.inCar ? vehicles.byId(state.player.carId) : null;
  audio.step(dt, car ? car.speed : 0, state.wanted);

  // autosave every ~10 s of play
  if (state.time - lastSave > 10) { lastSave = state.time; saveGame(state); }
  hud.update(dt, G);
}

// --- screenshot scenes ------------------------------------------------------
let frozen = false;
function placePlayerOnFoot(x, z, yaw) {
  state.player.inCar = false; state.player.carId = -1;
  state.player.x = x; state.player.z = z; state.player.y = 0; state.player.yaw = yaw;
  state.player.onGround = true;
}
function placePlayerInCar(type, x, z, heading, speed) {
  const car = vehicles.addCar(type, x, z, heading, {});
  car.speed = speed;
  state.player.inCar = true; state.player.carId = car.id;
  state.player.x = x; state.player.z = z; state.player.yaw = heading;
  return car;
}
function settle(frames) {
  for (let i = 0; i < frames; i++) {
    vehicles.step(FIXED, G);
    pedestrians.step(FIXED, G);
    police.step(FIXED, G);
    fx.step(FIXED);
  }
  player.step(0, G);
  hud.update(0.016, G);
}
function runShot(name) {
  titleEl.style.display = 'none';
  pauseEl.style.display = 'none';
  overEl.style.display = 'none';
  hud.show();
  state.screen = 'play';
  state.started = true;
  state.health = 100; state.armor = 50; state.cash = 1250;
  state.weaponsOwned.pistol = true; state.ammo.pistol = 60; state.mag.pistol = 12;
  state.weapon = 'pistol';

  if (name === 'chase') {
    // COVER: Vento GT at speed, 3 stars, 2 cruisers behind, traffic ahead.
    state.wanted = 3;
    state.missionIndex = 3; state.missionStage = 0;
    const car = placePlayerInCar('vento', 37.5, 60, Math.PI, 30);
    car.hp = 82;
    // camera just behind the car: cruisers sit between camera and player,
    // offset to the sides so they stay in frame at the edges
    state.camYaw = 0.12; state.camPitch = 0.32; state.camDist = 16;
    const c1 = vehicles.addCar('cruiser', 30.5, 65, Math.PI, {}); c1.speed = 30;
    const c2 = vehicles.addCar('cruiser', 44.5, 66.5, Math.PI, {}); c2.speed = 28;
    police.cruisers.push(c1, c2);
    const t1 = vehicles.cars.find((c) => c.traffic && Math.abs(c.x - 37.5) < 8);
    if (t1) { t1.x = 37.5; t1.z = 0; t1.heading = Math.PI; t1.speed = 12; }
    const t2 = vehicles.cars.find((c) => c.traffic && c !== t1);
    if (t2) { t2.x = 30; t2.z = 20; t2.heading = Math.PI; t2.speed = 11; }
    settle(24);
    hud.banner('MISSION 4: HEAT WAVE', 'Lose the dragnet — reach the Safehouse!');
    fx.spawnSmoke(car.x, car.z, 4);
  } else if (name === 'street') {
    // On foot in the plaza at golden hour, peds, parked cars, palms, ocean glimpse.
    state.wanted = 0;
    state.missionIndex = 0; state.missionStage = 0;
    placePlayerOnFoot(12, -16, 0); // north side of the plaza, facing south: fountain, then the beach
    state.camYaw = Math.PI; state.camPitch = 0.3; state.camDist = 9;
    const spots = [[-8, 10, 0.5], [6, 8, 2.6], [-14, 26, 1.2], [12, 30, 4.0], [-4, -6, 3.1]];
    for (const [x, z, h] of spots) {
      const ped = pedestrians.addPed(x, z);
      ped.heading = h; ped.target = { x: x + 10, z: z + 10 };
    }
    settle(10);
    hud.toast('Solmar Plaza — golden hour. Steal a car (F) to start Mission 1.');
  } else if (name === 'mission') {
    // Meridian Bank shootout: pistol aimed, muzzle flash, guard + cop, 3 stars.
    // The player stands on the road in front of the bank (not against its wall),
    // guards in the open between player and bank doors.
    state.wanted = 3;
    state.missionIndex = 4; state.missionStage = 1;
    placePlayerOnFoot(75, -37.5, Math.PI); // on the road, facing north at the bank
    state.camYaw = 0; state.camPitch = 0.25; state.camDist = 9;
    const guard = pedestrians.addPed(68, -48, { isGuard: true, name: 'guard' });
    guard.heading = 0;
    combat.addEnemy(guard, 70, 'guard');
    const cop = pedestrians.addPed(84, -48, { isCop: true, name: 'cop' });
    cop.heading = 0;
    combat.addEnemy(cop, 60, 'cop');
    const c1 = vehicles.addCar('cruiser', 88, -48, Math.PI, {}); c1.speed = 0;
    police.cruisers.push(c1);
    settle(8);
    fx.spawnMuzzle(G);
    fx.spawnSmoke(76, -48, 5);
    hud.banner('MISSION 5: MERIDIAN JOB', 'Take out the guards — then grab the cash!');
  } else if (name === 'drive') {
    // High-speed boulevard run toward the beach and the setting sun.
    state.wanted = 0;
    state.missionIndex = 0; state.missionStage = 1;
    const car = placePlayerInCar('vento', 37.5, 170, 0, 38); // heading south (+z)
    state.camYaw = Math.PI; state.camPitch = 0.24; state.camDist = 12;
    const t1 = vehicles.cars.find((c) => c.traffic);
    if (t1) { t1.x = 37.5; t1.z = 225; t1.heading = 0; t1.speed = 13; }
    const t2 = vehicles.cars.find((c) => c.traffic && c !== t1);
    if (t2) { t2.x = -37.5; t2.z = 200; t2.heading = 0; t2.speed = 12; }
    settle(20);
    hud.toast('Mission 1: First Wheels — drive it to Marlow\'s Garage.');
  }
  updateCamera(0);
  hud.update(0.016, G);
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

// --- main loop --------------------------------------------------------------
let last = performance.now();
let accumulator = 0;
const MAX_FRAME = 0.25;
function frame(now) {
  requestAnimationFrame(frame);
  if (frozen) return;
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  if (state.screen === 'play') {
    while (accumulator >= FIXED) { stepSim(FIXED); accumulator -= FIXED; }
  } else {
    accumulator = 0;
    // title backdrop: slow orbit over the plaza
    if (state.screen === 'title') {
      const t = now / 1000;
      state.camYaw = t * 0.05;
      camera.position.set(Math.sin(t * 0.05) * 40, 26, Math.cos(t * 0.05) * 40);
      camera.lookAt(0, 2, 0);
    }
  }
  if (state.screen !== 'title') updateCamera(0.016);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__solmar = { state, G };
if (shot) runShot(shot);
else {
  showTitle();
  requestAnimationFrame(frame);
}
