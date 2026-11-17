// SOLMAR — story missions (6, chained), side jobs (Taxi / Courier / Rampage),
// sun-coins, the gun locker, and busted / wasted respawns.
import { MISSIONS, PLACES, SIDE_JOBS, COIN_VALUE, WEAPONS } from './config.js';
import { saveGame, addCash } from './state.js';
import { range, pick } from './random.js';

function dTo(G, x, z) {
  const p = G.state.player;
  return Math.hypot(p.x - x, p.z - z);
}

export function createMissions() {
  let courierCar = null;
  let guards = [];

  function currentTarget(G) {
    const s = G.state;
    if (s.sideJob) {
      const j = s.sideJob;
      if (j.kind === 'taxi') return j.stage === 0 ? { x: PLACES.taxiStand.x, z: PLACES.taxiStand.z } : j.target;
      if (j.kind === 'courier') return j.targets[j.stage];
      if (j.kind === 'rampage') return { x: PLACES.park.x, z: PLACES.park.z };
    }
    if (s.storyComplete) return null;
    const mi = s.missionIndex, st = s.missionStage, d = s.missionData;
    switch (mi) {
      case 0: return st === 0 ? null : { x: PLACES.garage.x, z: PLACES.garage.z };
      case 1: return st === 0 ? { x: PLACES.docks.x, z: PLACES.docks.z }
        : st === 1 ? { x: PLACES.docks.x, z: PLACES.docks.z } : { x: PLACES.garage.x, z: PLACES.garage.z };
      case 2: return courierCar ? { x: courierCar.x, z: courierCar.z } : { x: 0, z: -150 };
      case 3: return { x: PLACES.safehouse.x, z: PLACES.safehouse.z };
      case 4: return st < 3 ? { x: PLACES.bank.x, z: PLACES.bank.z } : { x: PLACES.safehouse.x, z: PLACES.safehouse.z };
      case 5: return st < 3 ? { x: PLACES.casino.x, z: PLACES.casino.z } : { x: PLACES.yacht.x, z: PLACES.yacht.z };
      default: return null;
    }
  }

  function startMission(G, index) {
    const s = G.state;
    s.missionIndex = index; s.missionStage = 0; s.missionData = {};
    guards = [];
    const m = MISSIONS[index];
    G.hud.banner(`MISSION ${index + 1}: ${m.name.toUpperCase()}`, m.intro);
    G.hud.announce(`Mission ${index + 1}: ${m.name}. ${m.intro}`);
    G.audio.sting();
    if (index === 3) { G.police.addWanted(G, 2, 'Dragnet active'); }
    if (index === 2) {
      courierCar = G.vehicles.addCar('kroll', 0, -240, 0, {}); // driven by the mission, not traffic AI
      courierCar.speed = 12;
      courierCar.target = { x: 0, z: 240, then: null };
    }
    saveGame(s);
  }

  function completeMission(G) {
    const s = G.state;
    const m = MISSIONS[s.missionIndex];
    addCash(s, m.reward, m.name);
    s.stats.missions++;
    s.missionDone[s.missionIndex] = true;
    G.hud.banner('MISSION COMPLETE', `${m.name} — +$${m.reward}`);
    G.hud.feed(`Mission complete: ${m.name} (+$${m.reward})`);
    G.audio.sting();
    if (courierCar) { courierCar.dead = true; courierCar.mesh.visible = false; courierCar = null; }
    s.missionIndex++;
    if (s.missionIndex >= MISSIONS.length) {
      s.storyComplete = true;
      G.hud.banner('THE BIG ONE — DONE', 'Solmar Bay is yours, Mara. Free roam unlocked.');
    } else {
      startMission(G, s.missionIndex);
    }
    saveGame(s);
  }

  function spawnGuards(G, cx, cz, n, role) {
    guards = [];
    for (let i = 0; i < n; i++) {
      const ped = G.pedestrians.addPed(cx + range(Math.random, -8, 8), cz + range(Math.random, -8, 8), { isGuard: true, name: role });
      ped.state = 'walk';
      const e = G.combat.addEnemy(ped, role === 'guard' ? 70 : 60, role);
      guards.push(e);
    }
    return guards;
  }

  function guardsAlive() { return guards.filter((g) => g.alive).length; }

  function busted(G, msg) {
    const s = G.state;
    if (s.screen !== 'play') return;
    const fine = Math.min(200, Math.floor(s.cash * 0.2));
    s.cash -= fine;
    s.screen = 'busted';
    G.police.clearAll(G);
    s.player.inCar = false; s.player.carId = -1;
    s.player.x = PLACES.safehouse.x + 6; s.player.z = PLACES.safehouse.z + 6; s.player.y = 0;
    s.health = 100; s.armor = 0; s.bustTimer = 0;
    G.audio.fail();
    G.ui.showOver('BUSTED', `${msg} Fine: $${fine}. You wake up at the safehouse — the job is still on.`);
    saveGame(s);
  }

  function wasted(G, msg) {
    const s = G.state;
    if (s.screen !== 'play') return;
    s.cash = Math.max(0, s.cash - 100);
    s.screen = 'wasted';
    G.police.clearAll(G);
    s.player.inCar = false; s.player.carId = -1;
    s.player.x = PLACES.safehouse.x + 6; s.player.z = PLACES.safehouse.z + 6; s.player.y = 0;
    s.health = 100; s.armor = 50; s.deadTimer = 0;
    G.audio.fail();
    G.ui.showOver('WASTED', `${msg} Hospital bill: $100. Back on your feet at the safehouse.`);
    saveGame(s);
  }

  // ---- side jobs ----------------------------------------------------------
  function startSideJob(G, kind) {
    const s = G.state;
    if (s.sideJob) { G.hud.toast('Finish the current side job first'); return; }
    if (kind === 'taxi') {
      const ped = G.pedestrians.addPed(PLACES.taxiStand.x + 2, PLACES.taxiStand.z + 2, { name: 'passenger' });
      ped.state = 'passenger';
      s.sideJob = { kind, name: 'Taxi', stage: 0, timer: 90, target: null, ped };
      G.hud.banner('SIDE JOB: TAXI', 'Pick up the passenger at the taxi stand.');
    } else if (kind === 'courier') {
      s.sideJob = {
        kind, name: 'Courier', stage: 0, timer: 90,
        targets: [
          { x: PLACES.plaza.x + 20, z: PLACES.plaza.z - 20 },
          { x: PLACES.bank.x, z: PLACES.bank.z + 30 },
          { x: PLACES.docks.x, z: PLACES.docks.z - 20 },
        ],
      };
      G.hud.banner('SIDE JOB: COURIER', 'Deliver 3 packages — 90 seconds on the clock.');
    } else if (kind === 'rampage') {
      s.sideJob = { kind, name: 'Rampage', stage: 0, timer: 60, smashed: 0 };
      G.hud.banner('SIDE JOB: RAMPAGE', 'Smash 10 props in 60 seconds. Use a car!');
    }
    G.audio.sting();
  }

  function finishSideJob(G, ok) {
    const s = G.state;
    const j = s.sideJob;
    if (!j) return;
    if (j.ped) { j.ped.alive = false; j.ped.mesh.visible = false; }
    if (ok) {
      const reward = SIDE_JOBS[j.kind].reward;
      addCash(s, reward, j.name);
      s.sideJobsDone++;
      G.hud.banner('SIDE JOB DONE', `${j.name} — +$${reward}`);
      G.audio.sting();
    } else {
      G.hud.toast(`${j.name} failed — the clock ran out.`);
      G.audio.fail();
    }
    s.sideJob = null;
    saveGame(s);
  }

  // ---- interaction --------------------------------------------------------
  function promptFor(G) {
    const s = G.state;
    if (s.screen !== 'play') return '';
    const p = s.player;
    // nearest car prompt
    if (!p.inCar) {
      const car = G.vehicles.nearestCar(p.x, p.z, 4.5);
      if (car) return `F — STEAL ${car.def.name.toUpperCase()}`;
    } else {
      return 'F — EXIT CAR';
    }
    // mission / job interaction points
    if (!s.storyComplete) {
      const mi = s.missionIndex, st = s.missionStage;
      if (mi === 1 && st === 1 && dTo(G, PLACES.docks.x, PLACES.docks.z) < 10) return 'E — COLLECT THE PACKAGE';
      if (mi === 4 && st === 2 && dTo(G, PLACES.bank.x, PLACES.bank.z) < 12) return 'E — GRAB THE CASH';
      if (mi === 5 && st === 2 && dTo(G, PLACES.casino.x, PLACES.casino.z) < 12) return 'E — CRACK THE VAULT';
    }
    if (dTo(G, PLACES.gunlocker.x, PLACES.gunlocker.z) < 8) {
      const next = ['pistol', 'smg', 'shotgun'].find((w) => !s.weaponsOwned[w]);
      if (next) return `E — BUY ${WEAPONS[next].name.toUpperCase()} ($${WEAPONS[next].price})`;
      return 'E — BUY AMMO ($40)';
    }
    if (dTo(G, PLACES.taxiStand.x, PLACES.taxiStand.z) < 8 && !s.sideJob) return 'E — START TAXI JOB ($120)';
    if (dTo(G, PLACES.docks.x, PLACES.docks.z) < 10 && !s.sideJob) return 'E — START COURIER JOB ($180)';
    if (dTo(G, PLACES.park.x, PLACES.park.z) < 14 && !s.sideJob) return 'E — START RAMPAGE ($250)';
    return '';
  }

  function tryInteract(G) {
    const s = G.state;
    if (s.screen !== 'play') return;
    const mi = s.missionIndex, st = s.missionStage;
    if (!s.storyComplete) {
      if (mi === 1 && st === 1 && dTo(G, PLACES.docks.x, PLACES.docks.z) < 10) {
        s.missionStage = 2;
        G.police.addWanted(G, 1, 'Package lifted — docks security called it in');
        G.hud.toast('Package secured. Bring it back to the garage.');
        G.audio.pickup();
        return;
      }
      if (mi === 4 && st === 2 && dTo(G, PLACES.bank.x, PLACES.bank.z) < 12) {
        s.missionStage = 3;
        addCash(s, 300, 'Bank cash');
        G.police.addWanted(G, 3, 'Bank alarm tripped');
        G.hud.banner('CASH GRABBED', 'Get to a car and reach the Safehouse!');
        G.audio.sting();
        return;
      }
      if (mi === 5 && st === 2 && dTo(G, PLACES.casino.x, PLACES.casino.z) < 12) {
        s.missionStage = 3;
        addCash(s, 800, 'Casino vault');
        G.police.addWanted(G, 4, 'Casino vault breached');
        G.hud.banner('VAULT CRACKED', 'Run for the yacht at Sunset Pier!');
        G.audio.sting();
        return;
      }
    }
    if (dTo(G, PLACES.gunlocker.x, PLACES.gunlocker.z) < 8) {
      const next = ['pistol', 'smg', 'shotgun'].find((w) => !s.weaponsOwned[w]);
      if (next) {
        if (s.cash >= WEAPONS[next].price) {
          s.cash -= WEAPONS[next].price;
          s.weaponsOwned[next] = true;
          s.ammo[next] = WEAPONS[next].mag * 2;
          s.weapon = next;
          G.hud.toast(`${WEAPONS[next].name} bought — press ${next === 'pistol' ? '2' : next === 'smg' ? '3' : '4'} to equip`);
          G.audio.pickup();
        } else G.hud.toast(`Need $${WEAPONS[next].price} for the ${WEAPONS[next].name}`);
      } else if (s.cash >= 40) {
        s.cash -= 40;
        s.ammo.pistol += 24; s.ammo.smg += 60; s.ammo.shotgun += 12;
        G.hud.toast('Ammo restocked (+24 pistol / +60 SMG / +12 shotgun)');
        G.audio.pickup();
      } else G.hud.toast('Not enough cash for ammo ($40)');
      return;
    }
    if (dTo(G, PLACES.taxiStand.x, PLACES.taxiStand.z) < 8 && !s.sideJob) { startSideJob(G, 'taxi'); return; }
    if (dTo(G, PLACES.docks.x, PLACES.docks.z) < 10 && !s.sideJob) { startSideJob(G, 'courier'); return; }
    if (dTo(G, PLACES.park.x, PLACES.park.z) < 14 && !s.sideJob) { startSideJob(G, 'rampage'); return; }
  }

  // ---- per-frame update ----------------------------------------------------
  function update(dt, G) {
    const s = G.state;
    if (s.screen !== 'play') return;
    // sun-coins
    for (const c of G.city.coins) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2;
      c.mesh.position.y = 1.4 + Math.sin(s.time * 2 + c.phase) * 0.25;
      if (Math.hypot(s.player.x - c.x, s.player.z - c.z) < 2.4) {
        c.taken = true; c.mesh.visible = false;
        s.coins++;
        addCash(s, COIN_VALUE, 'Sun-coin');
        G.audio.coin();
        G.hud.feed(`Sun-coin ${s.coins}/24 (+$${COIN_VALUE})`);
        if (s.coins >= 24) G.hud.banner('ALL SUN-COINS', '24/24 — you found every coin in Solmar Bay.');
      }
    }
    // mission beacon follows the current target
    const target = currentTarget(G);
    const beacon = G.city.markers.mission;
    if (beacon && beacon.beacon) {
      const vis = !!target;
      beacon.beacon.visible = vis; beacon.ring.visible = vis;
      if (target) {
        beacon.beacon.position.set(target.x, 30, target.z);
        beacon.ring.position.set(target.x, 0.12, target.z);
      }
    }
    // story machine
    if (!s.storyComplete) {
      const mi = s.missionIndex, st = s.missionStage, d = s.missionData;
      if (mi === 0) {
        if (st === 0 && s.player.inCar) { s.missionStage = 1; G.hud.toast('Nice wheels. Now bring it to Marlow\'s Garage.'); }
        else if (st === 1 && dTo(G, PLACES.garage.x, PLACES.garage.z) < 14) completeMission(G);
      } else if (mi === 1) {
        if (st === 0 && dTo(G, PLACES.docks.x, PLACES.docks.z) < 12) { s.missionStage = 1; G.hud.toast('The package is here — press E to collect it.'); }
        else if (st === 2 && dTo(G, PLACES.garage.x, PLACES.garage.z) < 14) completeMission(G);
      } else if (mi === 2) {
        if (courierCar && !courierCar.dead) {
          // courier drives a loop along the coast roads
          const c = courierCar;
          if (!c.target || Math.hypot(c.target.x - c.x, c.target.z - c.z) < 4) {
            const stops = [{ x: 0, z: 240 }, { x: 240, z: 240 }, { x: 240, z: -240 }, { x: 0, z: -240 }, { x: -240, z: -240 }, { x: -240, z: 240 }];
            const next = stops[(d.stopIdx || 0) % stops.length];
            d.stopIdx = (d.stopIdx || 0) + 1;
            c.target = { x: next.x, z: next.z, then: null };
          }
          const dx = c.target.x - c.x, dz = c.target.z - c.z;
          const dist = Math.hypot(dx, dz);
          c.heading = Math.atan2(dx, dz);
          c.speed = 12;
          c.x += Math.sin(c.heading) * c.speed * dt;
          c.z += Math.cos(c.heading) * c.speed * dt;
          const pd = Math.hypot(s.player.x - c.x, s.player.z - c.z);
          if (st === 0 && pd < 45) { s.missionStage = 1; G.hud.toast('Tail him — stay 10–40 m behind. Do NOT ram him.'); }
          if (st === 1) {
            if (pd >= 10 && pd <= 40) d.tail = (d.tail || 0) + dt;
            else if (pd > 60) d.tail = Math.max(0, (d.tail || 0) - dt * 2);
            if (pd < 4.5 && s.player.inCar) {
              d.spotted = (d.spotted || 0) + dt * 25;
              if (d.spotted > 0) G.hud.toast('Too close! He is getting suspicious…');
            } else d.spotted = Math.max(0, (d.spotted || 0) - dt * 10);
            if ((d.spotted || 0) >= 100) {
              s.missionStage = 0; s.missionData = {};
              G.hud.banner('SPOTTED!', 'The courier made you. Fall back and try again.');
              G.audio.fail();
            }
            if ((d.tail || 0) >= 20) completeMission(G);
            else if (st === 1) G.hud.toast(`Tailing… ${Math.floor(d.tail || 0)}/20 s`);
          }
        }
      } else if (mi === 3) {
        if (dTo(G, PLACES.safehouse.x, PLACES.safehouse.z) < 14) completeMission(G);
        else if (s.wanted === 0) completeMission(G);
      } else if (mi === 4) {
        if (st === 0 && dTo(G, PLACES.bank.x, PLACES.bank.z) < 16 && !s.player.inCar) {
          s.missionStage = 1; spawnGuards(G, PLACES.bank.x, PLACES.bank.z, 4, 'guard');
          G.hud.banner('MERIDIAN BANK', 'Take out the guards — then grab the cash.');
        } else if (st === 1 && guardsAlive() === 0) {
          s.missionStage = 2; G.hud.toast('Guards down. Grab the cash — press E at the bank doors.');
        } else if (st === 3 && s.player.inCar && dTo(G, PLACES.safehouse.x, PLACES.safehouse.z) < 14) completeMission(G);
      } else if (mi === 5) {
        if (st === 0 && dTo(G, PLACES.casino.x, PLACES.casino.z) < 16) {
          s.missionStage = 1; spawnGuards(G, PLACES.casino.x, PLACES.casino.z, 3, 'guard');
          G.hud.banner('THE PALMS', 'Casino guards are on you — clear them, crack the vault.');
        } else if (st === 1 && guardsAlive() === 0) {
          s.missionStage = 2; G.hud.toast('Clear. Crack the vault — press E at the casino doors.');
        } else if (st === 3 && dTo(G, PLACES.yacht.x, PLACES.yacht.z) < 16) completeMission(G);
      }
    }
    // side jobs
    const j = s.sideJob;
    if (j) {
      j.timer -= dt;
      if (j.timer <= 0) { finishSideJob(G, false); return; }
      if (j.kind === 'taxi') {
        if (j.stage === 0) {
          if (dTo(G, PLACES.taxiStand.x, PLACES.taxiStand.z) < 5 && s.player.inCar) {
            j.stage = 1; j.ped.alive = false; j.ped.mesh.visible = false;
            j.target = { x: pick(Math.random, [-150, 150, 225]), z: pick(Math.random, [-150, 150, 225]) };
            j.timer = 45;
            G.hud.toast('Passenger in! Deliver them to the marker — 45 s.');
            G.audio.pickup();
          }
        } else if (Math.hypot(s.player.x - j.target.x, s.player.z - j.target.z) < 10) finishSideJob(G, true);
      } else if (j.kind === 'courier') {
        const t = j.targets[j.stage];
        if (t && Math.hypot(s.player.x - t.x, s.player.z - t.z) < 9) {
          j.stage++;
          G.audio.pickup();
          if (j.stage >= j.targets.length) finishSideJob(G, true);
          else G.hud.toast(`Package ${j.stage}/3 delivered — next marker.`);
        }
      } else if (j.kind === 'rampage') {
        const car = s.player.inCar ? G.vehicles.byId(s.player.carId) : null;
        if (car) {
          for (const prop of G.city.props) {
            if (!prop.alive) continue;
            if (Math.hypot(prop.x - car.x, prop.z - car.z) < 2.6) {
              prop.alive = false; prop.mesh.visible = false;
              j.smashed++;
              G.fx.spawnSmoke(prop.x, prop.z, 5);
              G.audio.thud();
              G.hud.toast(`Smashed ${j.smashed}/10 props`);
              if (j.smashed >= 10) finishSideJob(G, true);
            }
          }
        }
      }
    }
  }

  return { currentTarget, startMission, completeMission, busted, wasted, update, promptFor, tryInteract, startSideJob };
}
