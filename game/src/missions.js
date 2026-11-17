// Story missions 1-6 (chained) + 3 repeatable side jobs. Each mission sets the
// HUD tracker text and the gold beacon position; rewards pay cash on completion.
import * as THREE from 'three';
import { MISSIONS, PLACES, SIDE_JOBS } from './config.js';
import { clamp } from './random.js';
import { createVehicle } from './vehicles.js';

function makeGuardMesh(scene, color = 0x3a2f2f) {
  const g = new THREE.Group();
  const suit = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a070 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.34), suit);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
  head.position.y = 1.62;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), suit);
  legL.position.set(-0.14, 0.31, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.3, 1.1, 0.3);
  g.add(body, head, legL, legR, gun);
  g.userData.legL = legL;
  g.userData.legR = legR;
  scene.add(g);
  return g;
}

export class MissionSys {
  constructor(scene) {
    this.scene = scene;
    this.guards = [];      // mission shooters {mesh,x,z,yaw,hp,alive,shootT,walkPhase,isGuard}
    this.courier = null;   // mission 3 van
    this.followT = 0;      // mission 3 progress seconds
    this.outOfRangeT = 0;
    this.holdT = 0;        // grab-cash hold timer
    this.sideTimer = 0;
    this.sideCount = 0;
    this.sideTarget = null; // {x,z}
    this.sideStage = 0;
    this.passenger = null;
    this.bannerT = 0;
    this.bannerText = '';
  }

  mission() {
    return MISSIONS[this.stateIdx] || null;
  }

  // Called by main when the story advances or a mission is (re)started.
  setMission(W, idx, stage = 0) {
    const { state } = W;
    state.missionIdx = idx;
    state.missionStage = stage;
    this.clearGuards(W);
    this.followT = 0;
    this.outOfRangeT = 0;
    this.holdT = 0;
    if (idx >= MISSIONS.length) {
      state.missionText = 'Story complete — Solmar is yours, Mara. Free roam!';
      W.setBeacon(null);
      return;
    }
    const m = MISSIONS[idx];
    this.bannerText = `MISSION ${m.id}: ${m.name}`;
    this.bannerT = 4;
    if (idx === 2) this.spawnCourier(W);
    this.refreshObjective(W);
  }

  clearGuards(W) {
    for (const g of this.guards) W.scene.remove(g.mesh);
    this.guards = [];
    if (this.courier) {
      W.scene.remove(this.courier.mesh);
      const i = W.vehicles.indexOf(this.courier);
      if (i >= 0) W.vehicles.splice(i, 1);
      this.courier = null;
    }
  }

  spawnCourier(W) {
    const v = createVehicle(W.scene, 'van', PLACES.docks.x - 20, PLACES.docks.z, Math.PI / 2, { driver: 'mission' });
    v.speed = 12;
    v.axis = 'x';
    v.dir = -1;
    v.road = v.z;
    W.vehicles.push(v);
    this.courier = v;
  }

  spawnGuards(W, x, z, n, color) {
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const gx = x + Math.cos(a) * 8;
      const gz = z + Math.sin(a) * 8;
      const mesh = makeGuardMesh(W.scene, color);
      mesh.position.set(gx, 0, gz);
      this.guards.push({ mesh, x: gx, z: gz, yaw: 0, hp: 60, alive: true, shootT: 1 + i * 0.5, walkPhase: 0, isGuard: true });
    }
  }

  completeMission(W) {
    const { state, audio, fx } = W;
    const m = MISSIONS[state.missionIdx];
    if (!m) return;
    state.cash += m.reward;
    state.missionIdx += 1;
    state.missionStage = 0;
    this.bannerText = `MISSION COMPLETE — $${m.reward}`;
    this.bannerT = 4;
    if (audio) audio.sting();
    if (fx) fx.burst(state.playerX || 0, 2, state.playerZ || 0, 20, 0xffd23e, 4);
    if (W.save) W.save();
    if (state.missionIdx < MISSIONS.length) this.setMission(W, state.missionIdx, 0);
    else {
      state.missionText = 'Story complete — Solmar is yours, Mara. Free roam!';
      W.setBeacon(null);
    }
  }

  failMission(W, reason) {
    const { state, audio } = W;
    this.bannerText = `FAILED — ${reason}`;
    this.bannerT = 4;
    if (audio) audio.fail();
    state.missionStage = 0;
    this.followT = 0;
    this.holdT = 0;
    this.clearGuards(W);
    if (state.missionIdx === 2) this.spawnCourier(W);
    this.refreshObjective(W);
  }

  refreshObjective(W) {
    const { state } = W;
    const idx = state.missionIdx;
    const stage = state.missionStage;
    const P = PLACES;
    const at = (place, text) => {
      state.missionText = text;
      W.setBeacon(place);
    };
    if (idx >= MISSIONS.length) return;
    if (idx === 0) {
      if (stage === 0) at(P.garage, "1. First Wheels — steal any car (walk up, press F)");
      else at(P.garage, '1. First Wheels — bring the car to Marlow\'s Garage');
    } else if (idx === 1) {
      if (stage === 0) at(P.docks, '2. The Pickup — drive to the Solmar Docks');
      else at(P.garage, '2. The Pickup — package grabbed! Bring it back to the garage');
    } else if (idx === 2) {
      at(null, "3. Tail Job — follow Kroll's van. Stay 10–55 m back. Do NOT ram it");
      if (this.courier) W.setBeacon({ x: this.courier.x, z: this.courier.z });
    } else if (idx === 3) {
      at(P.safehouse, '4. Heat Wave — lose the cops and reach the Safehouse');
    } else if (idx === 4) {
      if (stage === 0) at(P.bank, '5. Meridian Job — get to Meridian Bank on foot');
      else if (stage === 1) at(P.bank, '5. Meridian Job — hold at the bank to grab the cash!');
      else at(P.safehouse, '5. Meridian Job — escape in a car to the Safehouse (3 stars)');
    } else if (idx === 5) {
      if (stage === 0) at(P.casino, '6. The Big One — get to The Palms Casino');
      else if (stage === 1) at(P.casino, '6. The Big One — hold at the vault to crack it!');
      else at(P.pier, '6. The Big One — escape to the yacht at the pier (4 stars)');
    }
  }

  // Side jobs ------------------------------------------------------------
  startSideJob(W, kind) {
    const { state } = W;
    if (state.sideJob) return false;
    if (kind === 'taxi') {
      state.sideJob = { kind, stage: 0, timer: 60, target: null };
      this.sideTarget = { x: 150 + Math.random() * 100, z: -150 - Math.random() * 60 };
      state.missionText = `Side job: TAXI — pick up the passenger at the stand (E), deliver in 60 s`;
      W.setBeacon(PLACES.taxiStand);
    } else if (kind === 'courier') {
      state.sideJob = { kind, stage: 0, timer: 90, target: null };
      this.sideTarget = { x: -200 + Math.random() * 80, z: 100 + Math.random() * 80 };
      state.missionText = 'Side job: COURIER — deliver 3 packages, 90 s on the clock';
      W.setBeacon(this.sideTarget);
    } else if (kind === 'rampage') {
      state.sideJob = { kind, stage: 0, timer: 60, target: null };
      this.sideCount = 0;
      state.missionText = 'Side job: RAMPAGE — smash 10 street props in 60 s (drive through them!)';
      W.setBeacon(null);
    }
    this.bannerText = `SIDE JOB: ${SIDE_JOBS[kind].name}`;
    this.bannerT = 3;
    return true;
  }

  finishSideJob(W, success) {
    const { state, audio } = W;
    const job = state.sideJob;
    if (!job) return;
    if (success) {
      state.cash += SIDE_JOBS[job.kind].reward;
      this.bannerText = `SIDE JOB DONE — $${SIDE_JOBS[job.kind].reward}`;
      if (audio) audio.sting();
    } else {
      this.bannerText = 'SIDE JOB FAILED';
      if (audio) audio.fail();
    }
    this.bannerT = 3;
    state.sideJob = null;
    this.sideTarget = null;
    this.refreshObjective(W);
    if (W.save) W.save();
  }

  update(dt, W) {
    const { state, player, fx, audio } = W;
    if (this.bannerT > 0) this.bannerT -= dt;
    const px = player.pos.x;
    const pz = player.pos.z;
    state.playerX = px;
    state.playerZ = pz;

    // --- guards shoot at the player ---
    for (const g of this.guards) {
      if (!g.alive) continue;
      const dx = px - g.x;
      const dz = pz - g.z;
      const dist = Math.hypot(dx, dz);
      g.yaw = Math.atan2(dx, dz);
      if (dist < 34 && !player.vehicle) {
        g.shootT -= dt;
        if (g.shootT <= 0) {
          g.shootT = 0.8 + Math.random() * 0.8;
          if (Math.random() < clamp(0.45 - dist * 0.01, 0.08, 0.45)) {
            state.hp -= 6;
            if (fx) fx.burst(px, 1.2, pz, 4, 0xff5555, 2);
          }
          if (fx) fx.muzzle(g.x + Math.sin(g.yaw), 1.3, g.z + Math.cos(g.yaw), g.yaw);
          if (audio) audio.shoot('pistol');
        }
      } else if (dist < 34) {
        // guards chase on foot slowly
        g.x += Math.sin(g.yaw) * 3 * dt;
        g.z += Math.cos(g.yaw) * 3 * dt;
      }
      g.walkPhase += dt * 8;
      const swing = Math.sin(g.walkPhase) * 0.4;
      g.mesh.userData.legL.rotation.x = swing;
      g.mesh.userData.legR.rotation.x = -swing;
      g.mesh.position.set(g.x, 0, g.z);
      g.mesh.rotation.y = g.yaw;
    }
    this.guards = this.guards.filter((g) => g.alive || g.mesh.rotation.x !== 0);

    // --- side jobs ---
    if (state.sideJob) {
      const job = state.sideJob;
      job.timer -= dt;
      if (job.timer <= 0) {
        this.finishSideJob(W, false);
      } else if (job.kind === 'taxi') {
        if (job.stage === 0) {
          const d = Math.hypot(px - PLACES.taxiStand.x, pz - PLACES.taxiStand.z);
          if (d < 8 && player.vehicle) {
            job.stage = 1;
            state.missionText = 'TAXI — passenger aboard! Deliver to the marker, fast!';
            W.setBeacon(this.sideTarget);
          }
        } else if (this.sideTarget) {
          const d = Math.hypot(px - this.sideTarget.x, pz - this.sideTarget.z);
          if (d < 10 && player.vehicle) this.finishSideJob(W, true);
        }
      } else if (job.kind === 'courier') {
        if (this.sideTarget) {
          const d = Math.hypot(px - this.sideTarget.x, pz - this.sideTarget.z);
          if (d < 9) {
            job.stage += 1;
            if (job.stage >= 3) this.finishSideJob(W, true);
            else {
              this.sideTarget = { x: -250 + Math.random() * 480, z: -250 + Math.random() * 460 };
              W.setBeacon(this.sideTarget);
              state.missionText = `COURIER — package ${job.stage + 1} of 3, ${Math.ceil(job.timer)} s left`;
            }
          }
        }
      } else if (job.kind === 'rampage') {
        if (this.sideCount >= 10) this.finishSideJob(W, true);
        else state.missionText = `RAMPAGE — smashed ${this.sideCount}/10 props, ${Math.ceil(job.timer)} s left`;
      }
    }

    // --- story missions ---
    const idx = state.missionIdx;
    if (idx >= MISSIONS.length) return;
    const stage = state.missionStage;
    const near = (place, r) => Math.hypot(px - place.x, pz - place.z) < r;

    if (idx === 0) {
      if (stage === 0 && player.vehicle) {
        state.missionStage = 1;
        this.refreshObjective(W);
      } else if (stage === 1 && player.vehicle && near(PLACES.garage, 14)) {
        this.completeMission(W);
      }
    } else if (idx === 1) {
      if (stage === 0 && near(PLACES.docks, 14)) {
        state.missionStage = 1;
        if (W.addWanted) W.addWanted(1);
        this.bannerText = 'PACKAGE GRABBED — cops are coming!';
        this.bannerT = 3;
        this.refreshObjective(W);
      } else if (stage === 1 && near(PLACES.garage, 14)) {
        this.completeMission(W);
      }
    } else if (idx === 2) {
      const v = this.courier;
      if (!v || v.dead) {
        this.failMission(W, 'the courier got away');
        return;
      }
      W.setBeacon({ x: v.x, z: v.z });
      const d = Math.hypot(px - v.x, pz - v.z);
      if (d < 5.5) {
        this.failMission(W, 'spotted — you rammed the courier!');
        return;
      }
      if (d > 60) {
        this.outOfRangeT += dt;
        if (this.outOfRangeT > 6) {
          this.failMission(W, 'you lost the courier');
          return;
        }
      } else {
        this.outOfRangeT = 0;
        if (d > 10) this.followT += dt;
      }
      if (this.followT > 22) this.completeMission(W);
    } else if (idx === 3) {
      if (stage === 0) {
        if (state.wanted < 2 && W.addWanted) W.addWanted(2 - state.wanted);
        state.missionStage = 1;
      } else if (near(PLACES.safehouse, 13)) {
        state.wanted = 0;
        this.completeMission(W);
      }
    } else if (idx === 4) {
      if (stage === 0 && near(PLACES.bank, 16)) {
        state.missionStage = 1;
        this.spawnGuards(W, PLACES.bank.x, PLACES.bank.z, 3, 0x3a2f2f);
        this.refreshObjective(W);
      } else if (stage === 1) {
        if (!player.vehicle && near(PLACES.bank, 10)) {
          this.holdT += dt;
          state.missionText = `5. Meridian Job — grabbing the cash… ${Math.ceil(4 - this.holdT)} s`;
          if (this.holdT > 4) {
            state.missionStage = 2;
            if (W.addWanted) W.addWanted(3 - state.wanted > 0 ? 3 - state.wanted : 0);
            state.wanted = Math.max(state.wanted, 3);
            this.holdT = 0;
            this.refreshObjective(W);
          }
        } else {
          this.holdT = Math.max(0, this.holdT - dt);
        }
      } else if (stage === 2 && player.vehicle && near(PLACES.safehouse, 13)) {
        this.completeMission(W);
      }
    } else if (idx === 5) {
      if (stage === 0 && near(PLACES.casino, 18)) {
        state.missionStage = 1;
        this.spawnGuards(W, PLACES.casino.x, PLACES.casino.z, 4, 0x2f1a3a);
        this.refreshObjective(W);
      } else if (stage === 1) {
        if (!player.vehicle && near(PLACES.casino, 12)) {
          this.holdT += dt;
          state.missionText = `6. The Big One — cracking the vault… ${Math.ceil(5 - this.holdT)} s`;
          if (this.holdT > 5) {
            state.missionStage = 2;
            state.wanted = Math.max(state.wanted, 4);
            this.holdT = 0;
            this.refreshObjective(W);
          }
        } else {
          this.holdT = Math.max(0, this.holdT - dt);
        }
      } else if (stage === 2 && near(PLACES.pier, 14)) {
        this.completeMission(W);
      }
    }
  }
}
