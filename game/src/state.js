// SOLMAR — game state, autosave (localStorage) and run statistics.
import { SAVE_KEY, START_CASH, WEAPONS } from './config.js';

export function createState(seed) {
  return {
    seed,
    time: 0,
    screen: 'title',        // title | play | paused | busted | wasted | complete
    started: false,
    cash: START_CASH,
    health: 100,
    armor: 0,
    wanted: 0,
    wantedTimer: 0,
    missionIndex: 0,        // 0..5 story mission, 6 = story complete
    missionStage: 0,
    missionData: {},        // per-mission scratch (timers, flags)
    missionDone: [false, false, false, false, false, false],
    coins: 0,
    coinsGot: {},
    weaponsOwned: { fists: true, pistol: false, smg: false, shotgun: false },
    ammo: { pistol: 0, smg: 0, shotgun: 0 },
    mag: { pistol: 12, smg: 30, shotgun: 6 },
    weapon: 'fists',
    reloading: 0,
    sideJob: null,          // { kind, stage, timer, target }
    sideJobsDone: 0,
    stats: { carsStolen: 0, pedsHit: 0, copsDown: 0, shots: 0, kills: 0, missions: 0, earned: 0 },
    player: { x: 0, z: 40, y: 0, yaw: Math.PI, vy: 0, onGround: true, speed: 0, inCar: false, carId: -1 },
    camYaw: Math.PI, camPitch: 0.32, camDist: 9,
    bustTimer: 0, deadTimer: 0,
    muted: false,
    storyComplete: false,
  };
}

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash, health: state.health, armor: state.armor,
      missionIndex: state.missionIndex, missionDone: state.missionDone,
      coins: state.coins, coinsGot: state.coinsGot,
      weaponsOwned: state.weaponsOwned, ammo: state.ammo,
      stats: state.stats, storyComplete: state.storyComplete,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function applySave(state, data) {
  if (!data) return;
  state.cash = data.cash ?? START_CASH;
  state.health = data.health ?? 100;
  state.armor = data.armor ?? 0;
  state.missionIndex = data.missionIndex ?? 0;
  state.missionDone = data.missionDone ?? state.missionDone;
  state.coins = data.coins ?? 0;
  state.coinsGot = data.coinsGot ?? {};
  state.weaponsOwned = { ...state.weaponsOwned, ...(data.weaponsOwned ?? {}) };
  state.ammo = { ...state.ammo, ...(data.ammo ?? {}) };
  state.stats = { ...state.stats, ...(data.stats ?? {}) };
  state.storyComplete = !!data.storyComplete;
  // A loaded run always resumes armed: give the pistol back if it was owned.
  if (state.weaponsOwned.pistol && state.ammo.pistol <= 0) state.ammo.pistol = 24;
}

export function addCash(state, amount, reason) {
  state.cash += amount;
  if (amount > 0) state.stats.earned += amount;
  return reason || '';
}

export function weaponDef(id) { return WEAPONS[id]; }
