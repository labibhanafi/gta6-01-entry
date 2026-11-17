// Save state: cash, mission progress, weapons, sun-coins, stats. Kept plain and
// small so localStorage autosave is cheap and the title screen can Continue.
import { SAVE_KEY, SUN_COINS } from './config.js';

export function createState() {
  return {
    started: false,
    paused: false,
    over: false,
    overKind: null, // 'busted' | 'wasted' | null
    cash: 250,
    hp: 100,
    armor: 0,
    wanted: 0,
    missionIdx: 0,       // 0..5 story mission, 6 = story complete
    missionStage: 0,     // per-mission step
    missionText: '',
    sideJob: null,       // { kind, stage, timer, ... } or null
    coins: 0,
    coinsGot: new Array(SUN_COINS).fill(false),
    weapons: { fists: true, pistol: false, smg: false, shotgun: false },
    weapon: 'fists',
    ammo: { pistol: 0, smg: 0, shotgun: 0 },
    mag: { pistol: 12, smg: 30, shotgun: 6 },
    kills: 0,
    carsStolen: 0,
    playTime: 0,
    muted: false,
  };
}

export function saveGame(state) {
  try {
    const slim = {
      cash: state.cash, missionIdx: state.missionIdx, coins: state.coins,
      coinsGot: state.coinsGot, weapons: state.weapons, ammo: state.ammo,
      kills: state.kills, carsStolen: state.carsStolen, playTime: state.playTime,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(slim));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function applySave(state, save) {
  if (!save) return false;
  state.cash = save.cash ?? state.cash;
  state.missionIdx = save.missionIdx ?? 0;
  state.coins = save.coins ?? 0;
  if (Array.isArray(save.coinsGot)) state.coinsGot = save.coinsGot.slice(0, SUN_COINS);
  if (save.weapons) Object.assign(state.weapons, save.weapons);
  if (save.ammo) Object.assign(state.ammo, save.ammo);
  state.kills = save.kills ?? 0;
  state.carsStolen = save.carsStolen ?? 0;
  state.playTime = save.playTime ?? 0;
  return true;
}

export function hasSave() {
  return loadGame() !== null;
}
