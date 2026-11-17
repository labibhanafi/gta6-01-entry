// SOLMAR — the player on foot: Mara Quinn. WASD movement relative to the
// camera, jump, run, and F to steal / enter / exit cars.
import * as THREE from 'three';
import { clamp } from './random.js';

export function createPlayer(scene) {
  const group = new THREE.Group();
  const jacketMat = new THREE.MeshLambertMaterial({ color: 0xc23a4a });
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2a3547 });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xd8a878 });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

  const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.24), pantsMat); lLeg.position.set(-0.15, 0.42, 0); group.add(lLeg);
  const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.24), pantsMat); rLeg.position.set(0.15, 0.42, 0); group.add(rLeg);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.75, 0.36), jacketMat); torso.position.y = 1.22; torso.castShadow = true; group.add(torso);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), jacketMat); armL.position.set(-0.44, 1.2, 0); group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), jacketMat); armR.position.set(0.44, 1.2, 0); group.add(armR);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skinMat); head.position.y = 1.82; head.castShadow = true; group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hairMat); hair.position.y = 1.86; group.add(hair);
  // gun in hand (visible when armed)
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.5), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  gun.position.set(0.44, 1.05, 0.25); gun.visible = false; group.add(gun);
  scene.add(group);

  let walkPhase = 0;

  function step(dt, G) {
    const s = G.state;
    const p = s.player;
    if (p.inCar) {
      const car = G.vehicles.byId(p.carId);
      if (car) { p.x = car.x; p.z = car.z; p.yaw = car.heading; }
      group.visible = false;
      return;
    }
    group.visible = true;
    const input = G.input;
    const camYaw = s.camYaw;
    // movement relative to camera
    let mx = 0, mz = 0;
    if (input.forward) { mx -= Math.sin(camYaw); mz -= Math.cos(camYaw); }
    if (input.back) { mx += Math.sin(camYaw); mz += Math.cos(camYaw); }
    if (input.left) { mx -= Math.cos(camYaw); mz += Math.sin(camYaw); }
    if (input.right) { mx += Math.cos(camYaw); mz -= Math.sin(camYaw); }
    const len = Math.hypot(mx, mz);
    const speed = input.run ? 8.5 : 5.0;
    if (len > 0) {
      mx /= len; mz /= len;
      const nx = p.x + mx * speed * dt;
      const nz = p.z + mz * speed * dt;
      if (!G.city.hits(nx, nz, 0.55)) { p.x = nx; p.z = nz; }
      p.yaw = Math.atan2(mx, mz);
      p.speed = speed;
      walkPhase += dt * speed * 1.6;
    } else {
      p.speed = 0;
      walkPhase += dt * 0.5;
    }
    p.x = clamp(p.x, -292, 292); p.z = clamp(p.z, -292, 296);
    // jump (Space edge, consumed once here)
    if (input.takeJump() && p.onGround) {
      p.vy = 7.5; p.onGround = false;
    }
    if (!p.onGround) {
      p.vy -= 22 * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
    }
    // walk-cycle swing
    const swing = Math.sin(walkPhase) * (p.speed > 0 ? 0.55 : 0.06);
    lLeg.rotation.x = swing; rLeg.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8; armR.rotation.x = swing * 0.8;
    gun.visible = s.weapon !== 'fists';
    group.position.set(p.x, p.y, p.z);
    group.rotation.y = p.yaw;
  }

  function tryEnterCar(G) {
    const s = G.state;
    const p = s.player;
    if (p.inCar) {
      // exit: place Mara beside the car
      const car = G.vehicles.byId(p.carId);
      if (car) {
        p.x = car.x + Math.cos(car.heading) * 2.4;
        p.z = car.z - Math.sin(car.heading) * 2.4;
        p.y = 0;
        car.speed *= 0.4;
      }
      p.inCar = false; p.carId = -1;
      G.hud.toast('Out of the car');
      return;
    }
    const car = G.vehicles.nearestCar(p.x, p.z, 4.5);
    if (!car) { G.hud.toast('No car close enough — walk up to one and press F'); return; }
    if (car.traffic && car.driver) {
      // pull the driver out — he flees on foot
      car.driver = false; car.traffic = false; car.parked = false;
      const driver = G.pedestrians.addPed(car.x + 2, car.z + 2, { isDriver: true, name: 'driver' });
      driver.state = 'flee'; driver.fleeT = 3;
      s.stats.carsStolen++;
      G.police.addWanted(G, 1, 'Car stolen');
      G.hud.feed(`Stole a ${car.def.name} — +1 ★`);
      G.audio.sting();
    } else if (car.parked) {
      car.parked = false;
      s.stats.carsStolen++;
      G.police.addWanted(G, 1, 'Car stolen');
      G.hud.feed(`Stole a ${car.def.name} — +1 ★`);
    }
    p.inCar = true; p.carId = car.id;
    p.x = car.x; p.z = car.z;
    G.hud.toast(`Driving the ${car.def.name} — WASD to drive, Space = handbrake`);
  }

  return { group, step, tryEnterCar };
}
