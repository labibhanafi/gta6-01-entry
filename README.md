[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/labibhanafi/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/labibhanafi/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# SOLMAR — Streets of the Sun Coast

An original open-world crime game for the **make.fun gta6-01 "Make GTA 6"** competition.
Sun-soaked coastal city "Solmar Bay". You are **Mara Quinn**, getaway driver. Your fixer
is **Eddie Marlow**; the rival crew is run by **Vince Kroll**. No Rockstar names,
characters, places, art or music — everything here is original.

## How to play

Serve the game locally (no build step, no network at runtime):

```sh
node serve.ts
# open http://localhost:8080
```

Desktop Chrome. Click **START ENGINE** (or press Enter).

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse | Orbit camera (click to lock, drag works too) |
| Shift | Run |
| Space | Jump (on foot) / handbrake (in car) |
| F | Steal / enter / exit car |
| E | Interact (package, cash, vault, gun locker, side jobs) |
| Click | Punch / shoot |
| R | Reload |
| 1 / 2 / 3 / 4 | Fists / Pistol / SMG / Shotgun |
| C | Camera distance |
| M | Mute |
| Esc / P | Pause |

## What's in the game

- **City:** ~600×600 m grid city, 8×8 road grid, ~90 procedural buildings with
  canvas-generated facades, beach + ocean on the south edge, Sunset Pier, plaza
  with fountain, Palm Park, golden-afternoon sun, haze fog.
- **Cars:** steal parked and traffic cars (Vento GT, Marlow sedan, Taxista cab,
  Bruto pickup, Kroll SUV, delivery van) — arcade driving, handbrake drift,
  damage, smoke, explosions. Traffic drives the grid; 24 pedestrians stroll
  the sidewalks and flee gunfire.
- **Wanted:** 0–5 stars. Stealing, hitting peds, shooting and killing cops raise
  it. SPPD cruisers chase and ram; foot cops try to bust you. Lose them and the
  heat decays. Busted / Wasted respawns you at the safehouse and costs cash.
- **Story:** 6 chained missions from Marlow's garage to the casino vault at
  The Palms and the yacht escape — with objective markers, banners and payouts
  ($200 / $350 / $500 / $450 / $1,200 / $3,000).
- **Side jobs:** Taxi fares, Courier deliveries, Rampage — plus 24 hidden
  sun-coins ($50 each) scattered across the city.
- **Combat:** fists, pistol, SMG, shotgun (buy at Marlow's Gun Locker with cash),
  ammo + reload, muzzle flash, hitmarkers, enemy guards and cops who shoot back.
- **HUD + minimap:** health/armor, cash, wanted stars, weapon/ammo, speedometer,
  mission tracker, prompts, killfeed, live canvas minimap.
- **Save:** localStorage autosave (cash, missions, weapons, coins) — Continue
  from the title screen.
- **Sound:** 100% WebAudio synth — engine hum by speed, two-tone siren,
  gunshots, pickup blips, mission sting, bassline loop. No audio files.

## Screenshots

`1-chase.jpg` (cover) — Vento GT at speed, 3 stars, cruisers behind ·
`2-street.jpg` — on foot in Solmar Plaza at golden hour ·
`3-mission.jpg` — Meridian Bank shootout ·
`4-drive.jpg` — boulevard run toward the beach.

## Tech

- three.js 0.170.0 (vendored under `game/vendor/three/`, MIT)
- Plain ES modules, static files, zero network requests at runtime
- Fixed 60 Hz simulation; `?shot=chase|street|mission|drive&seed=1` stages
  deterministic screenshot scenes and sets `window.__shotReady`

## Packaging

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/game/, out/screenshots/ and out/dossier.json
```
