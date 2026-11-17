[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/labibhanafi/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/labibhanafi/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# SOLMAR — Streets of the Sun Coast

An original open-world crime game for make.fun's **gta6-01 "Make GTA 6"** competition.
You are Mara Quinn, getaway driver in the sun-soaked coastal city of Solmar Bay.
Fixer Eddie Marlow has work; rival Vince Kroll wants you off the road.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

Desktop Chrome, static files, zero network. Three.js is vendored under
`game/vendor/three/`.

## What is in the game

- **A city you can walk and drive**: 8×8 block grid (~600×600 m), ~90 procedural
  buildings with canvas-generated facades, beach + ocean, pier and yacht, park,
  plaza, palms, streetlights and traffic lights, golden-afternoon sun and haze.
- **Traffic + pedestrians**: 12 traffic cars on the road grid, 24 sidewalk walkers
  who flee gunfire, 10 parked cars to steal.
- **Cars to steal**: six box-built models (Vento GT sports, Bruto pickup, Taxista
  cab, Marlow sedan, Kroll SUV, courier van). Walk up, press **F** — traffic
  drivers get pulled out. Arcade physics: accel/brake, steer-by-speed,
  handbrake drift, collisions, damage smoke, explosion at 0 HP.
- **Wanted level + police**: 0–5 stars. Stealing, hitting pedestrians, shooting
  and killing cops raise it. Cruisers chase and ram, foot cops shoot; wanted
  decays when you are unseen and far away. Busted / Wasted respawns you at the
  safehouse / hospital and costs cash.
- **Story**: 6 chained missions — First Wheels, The Pickup, Tail Job, Heat Wave,
  Meridian Job, The Big One — each with a gold beacon, objective text and payout,
  plus 3 repeatable side jobs (Taxi, Courier, Rampage) and 24 hidden sun-coins.
- **Combat**: fists, pistol, SMG, shotgun (buy at Marlow's gun locker with cash),
  ammo, reload, muzzle flash, hitmarkers, exploding cars.
- **HUD + minimap**: health/armor bars, cash, wanted stars, weapon + ammo,
  speedometer in a car, mission tracker, prompts, damage vignette, live canvas
  minimap (roads, player arrow, traffic, cops, mission beacon).
- **Start + save**: title screen with Continue / New Game, pause, Busted/Wasted
  screens, localStorage autosave (cash, missions, weapons, coins).
- **Sound**: WebAudio synth only — engine hum by speed, two-tone siren,
  gunshots, pickup blips, mission sting, bassline loop. **M** mutes.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse | Orbit camera (click to pointer-lock, drag works too) |
| Shift | Run |
| Space | Jump (on foot) / handbrake (in car) |
| F | Steal / enter / exit car |
| E | Interact (jobs, gun locker) |
| LMB | Punch / shoot |
| R | Reload |
| 1–4 | Fists / pistol / SMG / shotgun |
| C | Camera distance |
| M | Mute |
| Esc / P | Pause |
| Enter | Start from the title screen |

## Screenshots

`shots.json` lists the four deterministic scenes (`?shot=chase|street|mission|drive`):
a police chase, the plaza at golden hour, the Meridian Bank shootout, and a
beach-road drive. The cover is `1-chase.jpg`.

## Layout

```
game/index.html        canvas + HUD DOM + import map
game/src/config.js     constants, palette, vehicle/weapon/mission defs
game/src/random.js     seeded RNG (mulberry32)
game/src/state.js      save/load (localStorage)
game/src/textures.js   canvas-generated building/road textures
game/src/city.js       city meshes, colliders, props, palms, beach, pier
game/src/vehicles.js   car factory, traffic AI, driving physics
game/src/pedestrians.js  walker AI, flee behaviour
game/src/police.js     wanted logic, cop AI, pursuit, bust
game/src/missions.js   story missions + side jobs
game/src/combat.js     shooting, melee, damage, explosions
game/src/audio.js      WebAudio synth SFX + music
game/src/input.js      keyboard/mouse/pointer
game/src/hud.js        DOM HUD + canvas minimap
game/src/effects.js    particles, muzzle, smoke, shake
game/src/player.js     on-foot controller, enter/exit/steal
game/src/main.js       boot, fixed 60 Hz loop, camera, ?shot= scenes
```

All art, names, characters and music are original. No Rockstar content.
