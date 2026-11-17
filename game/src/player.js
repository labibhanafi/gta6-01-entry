// Mara Quinn on foot: WASD movement relative to camera, jump, and the
// enter/exit/steal flow (F). Also owns E-interactions, coin pickup and
// the car-vs-pedestrian consequences.
import * as THREE from 'three';
import { PLACES, WEAPONS, SUN_COINS } from './config.js';
import { clamp } from './random.js';
import { collideCircle, pointInCollider } from './vehicles.js';

export function createPlayer(scene) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xc23a4a });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2b3a5a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.78, 0.34), jacket);
  body.position.y = 1.06;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
  head.position.y = 1.64;
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.38), new THREE.MeshLambertMaterial({ color: 0x2a1a12 }));
  hair.position.y = 1.84;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.64, 0.22), jeans);
  legL.position.set(-0.14, 0.32, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.16), jacket);
  armL.position.set(-0.38, 1.06, 0);
  const armR = armL.clone();
  armR.position.x = 0.38;
  // held gun, shown when armed
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.55), new THREE.MeshLambertMaterial({ color: 0x14161a }));
  gun.position.set(0.38, 1.0, 0.3);
  gun.visible = false;
  g.add(body, head, hair, legL, legR, armL, armR, gun);
  g.userData.legL = legL;
  g.userData.legR = legR;
  g.userData.armL = armL;
  g.userData.armR = armR;
  g.userData.gun = gun;
  scene.add(g);
  return {
    mesh: g,
    pos: new THREE.Vector3(-225, 0, -200),
    yaw: 0,
    pitch: 0,
    velY: 0,
    onGround: true,
    vehicle: null,
    walkPhase: 0,
    kick: 0,
    camMode: 0, // 0 near, 1 far, 2 top
    camYaw: 0,
    camPitch: 0.32,
    exitCooldown: 0,
  };
}

// Nearest drivable car within range of the player.
export function nearestCar(vehicles, x, z, maxD = 5) {
  let best = null;
  let bestD = maxD;
  for (const v of vehicles) {
    if (v.dead) continue;
    const d = Math.hypot(v.x - x, v.z - z);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

export function enterVehicle(W, v) {
  const { state, player, audio } = W;
  if (v.driver === 'traffic') {
    // pull the driver out: they flee, the theft is a crime
    if (W.addWanted) W.addWanted(1);
    state.carsStolen += 1;
    if (W.hud) W.hud.feed('You jacked a car — the driver ran for it!');
    if (audio) audio.shoot('pistol');
  } else if (v.driver === 'none') {
    state.carsStolen += 1;
  } else if (v.driver === 'cop' || v.driver === 'mission') {
    return false; // cannot steal a cop cruiser or the courier van
  }
  v.driver = 'player';
  player.vehicle = v;
  player.mesh.visible = false;
  return true;
}

export function exitVehicle(W) {
  const { player } = W;
  const v = player.vehicle;
  if (!v) return;
  v.driver = 'none';
  v.speed = 0;
  player.vehicle = null;
  player.mesh.visible = true;
  // step out to the side
  const sx = Math.cos(player.yaw) * 2.2;
  const sz = -Math.sin(player.yaw) * 2.2;
  player.pos.set(v.x + sx, 0, v.z + sz);
  player.exitCooldown = 0.6;
}

function buyNextWeapon(W) {
  const { state, audio, hud } = W;
  const order = ['pistol', 'smg', 'shotgun'];
  for (const key of order) {
    if (!state.weapons[key] && state.cash >= WEAPONS[key].price) {
      state.cash -= WEAPONS[key].price;
      state.weapons[key] = true;
      state.ammo[key] = WEAPONS[key].mag * 3;
      state.mag[key] = WEAPONS[key].mag;
      state.weapon = key;
      if (audio) audio.pickup();
      if (hud) hud.feed(`Bought ${WEAPONS[key].name} for $${WEAPONS[key].price}`);
      return true;
    }
  }
  // otherwise buy ammo for the current weapon
  const cur = state.weapon;
  if (cur !== 'fists' && state.cash >= 40) {
    state.cash -= 40;
    state.ammo[cur] += WEAPONS[cur].mag * 2;
    if (hud) hud.feed(`Bought ${WEAPONS[cur].name} ammo — $40`);
    if (audio) audio.pickup();
    return true;
  }
  if (hud) hud.feed("Marlow's Locker: not enough cash — jobs pay, Mara.");
  return false;
}

export function updatePlayer(dt, W) {
  const { state, player, input, city, fx, audio, hud, combat, missions } = W;
  player.exitCooldown = Math.max(0, player.exitCooldown - dt);
  const mouse = input.takeMouse();
  if (mouse.dx !== 0 || mouse.dy !== 0) W.lastMouseT = W.time;
  player.camYaw -= mouse.dx * 0.0032;
  player.camPitch = clamp(player.camPitch + mouse.dy * 0.0022, -0.15, 1.1);

  // camera mode + weapon keys
  if (input.wasPressed('KeyC')) player.camMode = (player.camMode + 1) % 3;
  if (input.wasPressed('KeyM')) {
    state.muted = !state.muted;
    if (audio) audio.setMuted(state.muted);
  }
  for (const [code, key] of [['Digit1', 'fists'], ['Digit2', 'pistol'], ['Digit3', 'smg'], ['Digit4', 'shotgun']]) {
    if (input.wasPressed(code) && state.weapons[key]) state.weapon = key;
  }
  if (input.wasPressed('KeyR') && combat) combat.startReload(W);

  const car = player.vehicle;
  if (car) {
    // --- driving ---
    const { driveVehicle } = W.vehicleFns;
    driveVehicle(car, input, dt, city.colliders, fx);
    player.pos.set(car.x, 0, car.z);
    player.yaw = car.yaw;
    // hit pedestrians while driving fast
    if (Math.abs(car.speed) > 4) {
      for (const p of W.peds) {
        if (!p.alive) continue;
        const d = Math.hypot(p.x - car.x, p.z - car.z);
        if (d < 2.0) {
          p.alive = false;
          p.mesh.rotation.x = Math.PI / 2;
          p.mesh.position.y = 0.3;
          if (W.addWanted) W.addWanted(1);
          if (hud) hud.feed('You hit a pedestrian — witnesses called it in!');
          if (fx) fx.burst(p.x, 1, p.z, 8, 0xff4444, 3);
          car.hp -= 4;
        }
      }
    }
    // smash props (rampage + general chaos)
    for (const prop of city.props) {
      if (!prop.alive) continue;
      const d = Math.hypot(prop.x - car.x, prop.z - car.z);
      if (d < 2.1 && Math.abs(car.speed) > 3) {
        prop.alive = false;
        prop.mesh.visible = false;
        if (fx) fx.burst(prop.x, 0.8, prop.z, 10, 0xd8b06a, 3);
        if (state.sideJob && state.sideJob.kind === 'rampage') missions.sideCount += 1;
        if (audio) audio.crash();
      }
    }
    // car explosion
    if (car.hp <= 0) {
      const { explodeVehicle } = W.combatFns;
      explodeVehicle(W, car);
      player.vehicle = null;
      player.mesh.visible = true;
      player.pos.set(car.x + 2, 0, car.z + 2);
      state.hp -= 25;
      if (W.addWanted) W.addWanted(1);
      if (hud) hud.feed('Your car blew up!');
    }
    if (input.wasPressed('KeyF') && player.exitCooldown <= 0) exitVehicle(W);
    return;
  }

  // --- on foot ---
  const run = input.has('ShiftLeft') || input.has('ShiftRight');
  const speed = run ? 8.5 : 4.6;
  let mx = 0;
  let mz = 0;
  if (input.has('KeyW')) mz += 1;
  if (input.has('KeyS')) mz -= 1;
  if (input.has('KeyA')) mx -= 1;
  if (input.has('KeyD')) mx += 1;
  const moving = mx !== 0 || mz !== 0;
  // movement is relative to the camera yaw: forward = (sin cy, cos cy),
  // screen-right = (-cos cy, sin cy); vel = forward*mz + right*mx.
  const cy = player.camYaw;
  const sin = Math.sin(cy);
  const cos = Math.cos(cy);
  let vx = 0;
  let vz = 0;
  if (moving) {
    const len = Math.hypot(mx, mz);
    const nx = mx / len;
    const nz = mz / len;
    vx = (nz * sin - nx * cos) * speed;
    vz = (nz * cos + nx * sin) * speed;
    player.yaw = Math.atan2(vx, vz);
  }
  const nx = player.pos.x + vx * dt;
  const nz = player.pos.z + vz * dt;
  const res = collideCircle(city.colliders, nx, nz, 0.55);
  player.pos.x = clamp(res.x, -295, 295);
  player.pos.z = clamp(res.z, -295, 330);
  if (res.hit && moving) {
    // slide along the wall: keep the unblocked axis
    const resX = collideCircle(city.colliders, nx, player.pos.z, 0.55);
    if (!resX.hit) player.pos.z = player.pos.z;
  }
  // jump + gravity
  if (input.wasPressed('Space') && player.onGround) {
    player.velY = 7.5;
    player.onGround = false;
  }
  if (!player.onGround) {
    player.velY -= 22 * dt;
    player.pos.y += player.velY * dt;
    if (player.pos.y <= 0) {
      player.pos.y = 0;
      player.velY = 0;
      player.onGround = true;
    }
  }
  // walk animation
  if (moving) player.walkPhase += dt * (run ? 12 : 8);
  const swing = moving ? Math.sin(player.walkPhase) * 0.55 : 0;
  player.mesh.userData.legL.rotation.x = swing;
  player.mesh.userData.legR.rotation.x = -swing;
  player.mesh.userData.armL.rotation.x = -swing * 0.7;
  player.mesh.userData.armR.rotation.x = swing * 0.7;
  player.mesh.userData.gun.visible = state.weapon !== 'fists';
  player.mesh.position.copy(player.pos);
  player.mesh.rotation.y = player.yaw;

  // --- steal / enter car ---
  const near = nearestCar(W.vehicles, player.pos.x, player.pos.z, 5);
  W.nearCar = near;
  if (near && input.wasPressed('KeyF') && player.exitCooldown <= 0) {
    enterVehicle(W, near);
  }

  // --- E interactions ---
  if (input.wasPressed('KeyE')) {
    const dGun = Math.hypot(player.pos.x - PLACES.gunshop.x, player.pos.z - PLACES.gunshop.z);
    const dTaxi = Math.hypot(player.pos.x - PLACES.taxiStand.x, player.pos.z - PLACES.taxiStand.z);
    const dPlaza = Math.hypot(player.pos.x - PLACES.plaza.x, player.pos.z - PLACES.plaza.z);
    const dDocks = Math.hypot(player.pos.x - PLACES.docks.x, player.pos.z - PLACES.docks.z);
    if (dGun < 12) buyNextWeapon(W);
    else if (dTaxi < 12 && !state.sideJob) missions.startSideJob(W, 'taxi');
    else if (dDocks < 14 && !state.sideJob) missions.startSideJob(W, 'courier');
    else if (dPlaza < 16 && !state.sideJob) missions.startSideJob(W, 'rampage');
    else if (hud) hud.feed('Nothing to do here — follow the gold beacon.');
  }

  // --- shooting / melee ---
  if (combat) {
    const targets = [
      ...W.peds.filter((p) => p.alive),
      ...W.police.cops.filter((c) => c.alive).map((c) => ({ ...c, isCop: true })),
      ...missions.guards.filter((g) => g.alive),
    ];
    if (input.firing) {
      if (state.weapon === 'fists') combat.melee(W, targets);
      else combat.tryFire(W, targets);
    }
  }

  // --- sun-coins ---
  for (const c of city.coins) {
    if (c.taken) continue;
    const d = Math.hypot(c.x - player.pos.x, c.z - player.pos.z);
    if (d < 2.0) {
      c.taken = true;
      c.mesh.visible = false;
      state.coins += 1;
      state.coinsGot[c.idx] = true;
      state.cash += 25;
      if (audio) audio.coin();
      if (hud) hud.feed(`Sun-coin ${state.coins}/${SUN_COINS} — +$25`);
    }
  }
}
