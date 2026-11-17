// SOLMAR — constants, palette, vehicle / weapon / mission definitions.
// Everything original: Solmar Bay, Mara Quinn, Eddie Marlow, Vince Kroll.
export const CITY = {
  HALF: 300,            // playable half-extent in metres (city is ~600 x 600 m)
  ROAD_STEP: 75,        // spacing between parallel roads
  ROAD_WIDTH: 14,
  BEACH_Z: 268,         // sand starts here (south edge, +z)
  OCEAN_Z: 298,         // water starts here
  BLOCK: 60,
};

export const ROADS = [-262.5, -187.5, -112.5, -37.5, 37.5, 112.5, 187.5, 262.5];
export const BLOCK_CENTERS = [-225, -150, -75, 0, 75, 150, 225];

// Named places on the map (x, z). South (+z) is the beach / ocean.
export const PLACES = {
  garage:    { x: -225, z: -225, label: "Marlow's Garage" },
  docks:     { x:  240, z:  240, label: 'Solmar Docks' },
  bank:      { x:   75, z:  -75, label: 'Meridian Bank' },
  casino:    { x:  225, z: -225, label: 'The Palms Casino' },
  safehouse: { x: -240, z:  240, label: 'Safehouse' },
  pier:      { x:    0, z:  300, label: 'Sunset Pier' },
  plaza:     { x:    0, z:    0, label: 'Solmar Plaza' },
  park:      { x:  -75, z:   75, label: 'Palm Park' },
  gunlocker: { x: -210, z: -210, label: "Marlow's Gun Locker" },
  taxiStand: { x:   37, z:   37, label: 'Taxi Stand' },
  yacht:     { x:   12, z:  330, label: 'Kroll Yacht' },
};

export const PALETTE = {
  skyTop: 0x2f6fb8, skyBottom: 0xffc98a, sun: 0xffd27a, fog: 0xf2b878,
  road: 0x2e3138, sidewalk: 0x9aa0a8, sand: 0xe8c98a, ocean: 0x1e6f8e,
  grass: 0x4f8f4a, buildingA: 0xd8c9a8, buildingB: 0xb8c4d0, buildingC: 0xe0a878,
  buildingD: 0x9fb8a8, buildingE: 0xc98a8a, palm: 0x2f7a3a, trunk: 0x7a5a38,
};

export const VEHICLES = {
  vento:   { name: 'Vento GT',   color: 0xffb52e, maxSpeed: 46, accel: 22, grip: 1.0,  hp: 100, price: 0 },
  marlow:  { name: 'Marlow Sedan', color: 0x3a6fd8, maxSpeed: 36, accel: 16, grip: 1.0, hp: 100, price: 0 },
  taxi:    { name: 'Taxista Cab',  color: 0xf2c200, maxSpeed: 34, accel: 15, grip: 1.0, hp: 100, price: 0 },
  bruto:   { name: 'Bruto Pickup', color: 0x8a4a2a, maxSpeed: 33, accel: 14, grip: 1.0, hp: 120, price: 0 },
  kroll:   { name: 'Kroll SUV',    color: 0x22242a, maxSpeed: 38, accel: 17, grip: 1.0, hp: 130, price: 0 },
  van:     { name: 'Delivery Van', color: 0xe8e8e8, maxSpeed: 30, accel: 12, grip: 1.0, hp: 120, price: 0 },
  cruiser: { name: 'SPPD Cruiser', color: 0x1a2a44, maxSpeed: 42, accel: 20, grip: 1.0, hp: 120, price: 0 },
};

export const WEAPONS = {
  fists:   { name: 'Fists',   damage: 18, rate: 0.38, range: 2.4,  mag: Infinity, reload: 0,   auto: false, spread: 0,    pellets: 1, price: 0 },
  pistol:  { name: 'Pistol',  damage: 34, rate: 0.26, range: 60,   mag: 12, reload: 1.1, auto: false, spread: 0.012, pellets: 1, price: 150 },
  smg:     { name: 'SMG',     damage: 16, rate: 0.09, range: 48,   mag: 30, reload: 1.4, auto: true,  spread: 0.035, pellets: 1, price: 400 },
  shotgun: { name: 'Shotgun', damage: 13, rate: 0.85, range: 26,   mag: 6,  reload: 2.0, auto: false, spread: 0.07,  pellets: 6, price: 550 },
};

export const MISSIONS = [
  { id: 1, name: 'First Wheels', reward: 200,
    intro: 'Marlow: "Mara. Need wheels. Steal any car on the street and bring it to my garage."',
    steps: ['Steal any car (walk up and press F)', 'Drive it to Marlow\'s Garage'] },
  { id: 2, name: 'The Pickup', reward: 350,
    intro: 'Marlow: "Package waiting at the docks. Grab it, bring it back. The docks are watched — expect heat."',
    steps: ['Drive to the Solmar Docks', 'Collect the package (E)', 'Bring the package back to the garage'] },
  { id: 3, name: 'Tail Job', reward: 500,
    intro: 'Marlow: "Kroll\'s courier is running the coast road. Tail him. Stay close, stay unseen — do NOT ram him."',
    steps: ['Find Kroll\'s courier car', 'Tail the courier — stay 10–40 m behind for 20 s'] },
  { id: 4, name: 'Heat Wave', reward: 450,
    intro: 'Marlow: "Cops are sweeping the whole bay. Lose the dragnet and get to the safehouse."',
    steps: ['Escape the 2-star dragnet', 'Reach the Safehouse unseen'] },
  { id: 5, name: 'Meridian Job', reward: 1200,
    intro: 'Marlow: "Meridian Bank. In, grab the cash, out. It will be loud — have a car ready."',
    steps: ['Get to Meridian Bank on foot', 'Take out the bank guards', 'Grab the cash (E)', 'Escape to the Safehouse at 3 stars'] },
  { id: 6, name: 'The Big One', reward: 3000,
    intro: 'Marlow: "The Palms casino vault. This is the one, Mara. Hit it, then run for the yacht at the pier."',
    steps: ['Reach The Palms Casino', 'Take out the casino guards', 'Crack the vault (E)', 'Escape to the yacht at Sunset Pier'] },
];

export const SIDE_JOBS = {
  taxi:    { name: 'Taxi',    reward: 120, text: 'Pick up the passenger and deliver them on time.' },
  courier: { name: 'Courier', reward: 180, text: 'Deliver 3 packages against the clock.' },
  rampage: { name: 'Rampage', reward: 250, text: 'Smash 10 props in 60 seconds.' },
};

export const SAVE_KEY = 'solmar-save-v1';
export const START_CASH = 500;
export const COIN_COUNT = 24;
export const COIN_VALUE = 50;
