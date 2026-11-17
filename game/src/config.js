// SOLMAR — Streets of the Sun Coast. Shared constants, palette and definitions.
// Everything original: sun-soaked coastal city, getaway driver Mara Quinn,
// fixer Eddie Marlow, rival Vince Kroll. No borrowed names, places or art.

export const CITY = {
  half: 300,            // city spans -300..300 on x and z
  roadSpacing: 75,      // grid pitch
  roadHalf: 6,          // half-width of a road
  beachZ: 238,          // sand starts here (south edge, +z)
  oceanZ: 282,          // water starts here
  blockInset: 14,       // buildings stay this far inside a block
};

export const PALETTE = {
  skyTop: 0x2f6fb4,
  skyBottom: 0xffd9a0,
  sun: 0xffe3b0,
  fog: 0xf2c98d,
  asphalt: 0x3a3a40,
  sidewalk: 0x9a938a,
  sand: 0xe8cf9a,
  ocean: 0x1d6f8f,
  grass: 0x5d8a4a,
};

// Landmark lots, in world x/z. The mission system and the minimap read these.
export const PLACES = {
  garage:    { x: -225, z: -225, name: "Marlow's Garage" },
  gunshop:   { x: -150, z: -225, name: "Marlow's Gun Locker" },
  safehouse: { x: -225, z: 225,  name: 'Safehouse' },
  docks:     { x: 240,  z: 180,  name: 'Solmar Docks' },
  bank:      { x: 37,   z: 37,   name: 'Meridian Bank' },
  casino:    { x: 225,  z: -225, name: 'The Palms Casino' },
  pier:      { x: 0,    z: 296,  name: 'The Pier Yacht' },
  plaza:     { x: 0,    z: 0,    name: 'Solmar Plaza' },
  park:      { x: -150, z: 150,  name: 'Palm Park' },
  taxiStand: { x: 75,   z: -225, name: 'Taxi Stand' },
};

// Vehicle models, all built from boxes in vehicles.js.
export const VEHICLES = {
  vento:   { name: 'Vento GT',    top: 46, accel: 26, brake: 42, steer: 1.9, hp: 120, color: 0xd8232a, len: 4.4, wid: 2.0 },
  bruto:   { name: 'Bruto Pickup',top: 38, accel: 20, brake: 38, steer: 1.6, hp: 160, color: 0x3f6d8e, len: 5.0, wid: 2.1 },
  taxista: { name: 'Taxista Cab', top: 34, accel: 17, brake: 36, steer: 1.7, hp: 110, color: 0xf2b705, len: 4.6, wid: 2.0 },
  marlow:  { name: 'Marlow Sedan',top: 36, accel: 19, brake: 38, steer: 1.7, hp: 130, color: 0x2b2f36, len: 4.8, wid: 2.0 },
  kroll:   { name: 'Kroll SUV',   top: 40, accel: 21, brake: 38, steer: 1.5, hp: 180, color: 0x5a2d82, len: 5.2, wid: 2.2 },
  van:     { name: 'Courier Van', top: 32, accel: 15, brake: 34, steer: 1.4, hp: 150, color: 0xe8e4da, len: 5.4, wid: 2.2 },
  cruiser: { name: 'Police Cruiser', top: 44, accel: 25, brake: 44, steer: 1.9, hp: 150, color: 0x1c2733, len: 4.8, wid: 2.0 },
};

// Weapons. price = gun-locker cost; owned weapons persist in the save.
export const WEAPONS = {
  fists:  { name: 'Fists',   slot: 1, price: 0,   damage: 12, rate: 2.2, range: 2.4,  mag: Infinity, auto: false, spread: 0,    kick: 0 },
  pistol: { name: 'P9 Pistol', slot: 2, price: 150, damage: 22, rate: 3.5, range: 70, mag: 12, auto: false, spread: 0.012, kick: 0.35 },
  smg:    { name: 'SMG',     slot: 3, price: 450, damage: 14, rate: 9,   range: 55, mag: 30, auto: true,  spread: 0.035, kick: 0.22 },
  shotgun:{ name: 'Scattergun', slot: 4, price: 600, damage: 16, rate: 1.1, range: 26, mag: 6, auto: false, spread: 0.09, kick: 0.9, pellets: 6 },
};

export const MISSIONS = [
  { id: 1, name: 'First Wheels',  brief: "Eddie Marlow needs wheels. Steal any car and bring it to Marlow's Garage.", reward: 200 },
  { id: 2, name: 'The Pickup',    brief: 'Drive to the Solmar Docks, grab the package, bring it back to the garage. Expect heat on pickup.', reward: 350 },
  { id: 3, name: 'Tail Job',      brief: "Follow Kroll's courier van. Stay close but unseen — do not ram it.", reward: 400 },
  { id: 4, name: 'Heat Wave',     brief: 'A 2-star dragnet is on you. Shake the cops and reach the Safehouse.', reward: 500 },
  { id: 5, name: 'Meridian Job',  brief: 'Hit Meridian Bank on foot, grab the cash, escape in a car at 3 stars.', reward: 1200 },
  { id: 6, name: 'The Big One',   brief: 'The Palms Casino vault. Four stars. Escape to the yacht at the pier.', reward: 3000 },
];

export const SIDE_JOBS = {
  taxi:    { name: 'Taxi Fare',    reward: 120 },
  courier: { name: 'Courier Run',  reward: 180 },
  rampage: { name: 'Rampage',      reward: 150 },
};

export const SAVE_KEY = 'solmar-save-v1';
export const SUN_COINS = 24;
export const MAX_WANTED = 5;

// Wanted decay: seconds unseen and far from cops before a star drops.
export const WANTED_DECAY_S = 14;
