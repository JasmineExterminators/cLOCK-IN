// Game data: ranks, payday, cities and their shop catalogs.
// Tweak numbers here to rebalance the economy.

export const RANKS = [
  { name: 'Intern', hours: 0, rate: 15 },
  { name: 'Associate', hours: 5, rate: 18 },
  { name: 'Analyst', hours: 15, rate: 22 },
  { name: 'Senior analyst', hours: 35, rate: 27 },
  { name: 'Manager', hours: 70, rate: 33 },
  { name: 'Director', hours: 120, rate: 40 },
  { name: 'Vice president', hours: 200, rate: 50 },
  { name: 'Chief lock-in officer', hours: 350, rate: 65 },
];

// Payday: every Friday at 5 PM local time (day 0 = Sunday).
export const PAYDAY = { day: 5, hour: 17 };

// Cities you work your way through. Only the first is open for now.
export const CITIES = [
  { id: 'pgh', name: 'Pittsburgh', open: true },
  { id: 'chi', name: 'Chicago', open: false, unlock: 'Own a Pittsburgh home worth $6,000 or more' },
  { id: 'nyc', name: 'New York', open: false, unlock: 'Own a Chicago home worth $25,000 or more' },
];

export const HOMES = [
  { id: 'pgh-dorm', city: 'pgh', art: 'dorm', name: 'Oakland dorm double', hood: 'Oakland', price: 0,
    color: '#b9a68c', tile: '#8f8b84', seed: 3,
    blurb: 'Bathroom down the hall, a roommate who snores, the 61C rattling by all night.' },
  { id: 'pgh-studio', city: 'pgh', art: 'studio', name: 'Oakland studio', hood: 'South Oakland', price: 300,
    color: '#d6d0c4', tile: '#77857c', seed: 5,
    blurb: 'Your own door at last, over a noodle shop. You can see the Cathedral of Learning from bed.' },
  { id: 'pgh-rowhouse', city: 'pgh', art: 'rowhouse', name: 'Lawrenceville rowhouse', hood: 'Lawrenceville', price: 900,
    color: '#9c4f3a', tile: '#8c6f60', seed: 7,
    blurb: 'Skinny brick rowhouse a block off Butler Street. The coffee shops are all yours.' },
  { id: 'pgh-townhouse', city: 'pgh', art: 'townhouse', name: 'Squirrel Hill townhouse', hood: 'Squirrel Hill', price: 2400,
    color: '#a8644c', tile: '#a0937a', seed: 9,
    blurb: 'Three floors of brick near Murray Ave, a roof deck, and bagels on Sunday.' },
  { id: 'pgh-house', city: 'pgh', art: 'house', name: 'Shadyside house with a yard', hood: 'Shadyside', price: 6000,
    color: '#e2d9c8', tile: '#77857c', seed: 11,
    blurb: 'A leafy street off Walnut, a rooftop garden, and a garage for the car.' },
  { id: 'pgh-penthouse', city: 'pgh', art: 'penthouse', name: 'Downtown penthouse', hood: 'Downtown', price: 14000,
    color: '#93a1ae', tile: '#97a5b4', seed: 13,
    blurb: 'Top floor in the Golden Triangle. Three rivers and a dozen yellow bridges below.' },
  { id: 'pgh-mansion', city: 'pgh', art: 'mansion', name: 'Riverfront mansion', hood: 'Fox Chapel', price: 30000,
    color: '#efe7d6', tile: '#6f7a8a', seed: 17, river: true,
    blurb: 'Columns, a pool, and your own dock on the Allegheny.' },
];

export const CARS = [
  { id: 'bike', name: 'Bike with a rusty chain', price: 0, kind: 'bike', color: '#c0503e', tile: '#8f8b84',
    blurb: 'Free, green, and no match for the hills. You will walk it up Forbes.' },
  { id: 'hatch', name: "'06 hatchback", price: 150, kind: 'car', color: '#d9a441', tile: '#8c6f60',
    len: 30, bodyH: 5, cab: [0.22, 0.74], roofH: 5, rust: 0.25, moss: 0.4, round: true, isoLen: 6,
    blurb: 'Fifteen winters of road salt, and something growing on the roof. It starts.' },
  { id: 'wagon', name: 'Used AWD wagon', price: 600, kind: 'car', color: '#5d6f86', tile: '#97a5b4',
    len: 36, bodyH: 5, cab: [0.2, 0.8], roofH: 5, rearSlope: 0, frontSlope: 2, isoLen: 8,
    blurb: 'All-wheel drive, for Canton Avenue in February.' },
  { id: 'van', name: 'Camper van', price: 1500, kind: 'van', color: '#7f9e8c', tile: '#77857c',
    len: 36, bodyH: 8, cab: [0.03, 0.86], roofH: 6, rearSlope: 0, frontSlope: 1, plant: true, moss: 0.25, isoLen: 8,
    blurb: 'Weekends at Ohiopyle, with a desk in the back for problem sets.' },
  { id: 'coupe', name: 'Weekend coupe', price: 4000, kind: 'sport', color: '#c0503e', tile: '#a0937a',
    len: 38, bodyH: 4, cab: [0.3, 0.7], roofH: 4, rearSlope: 3, frontSlope: 3, round: true, stripe: '#efe6d6', isoLen: 8,
    blurb: 'Built for speed. Spends most of its life stuck on the Parkway East.' },
  { id: 'super', name: 'Supercar', price: 12000, kind: 'sport', color: '#2f3036', tile: '#6f7a8a',
    len: 42, bodyH: 4, cab: [0.33, 0.66], roofH: 3, rearSlope: 4, frontSlope: 4, round: true, goldRims: true, isoLen: 9,
    blurb: 'Out of the Fort Pitt Tunnel, windows down, as the whole skyline appears.' },
  { id: 'vela-gt', name: 'Vela 12 GT', price: 25000, kind: 'sport', color: '#c4262b', tile: '#7c5f58',
    len: 46, bodyH: 4, cab: [0.36, 0.7], roofH: 3, rearSlope: 2, frontSlope: 2, pillarShift: 1, round: true, intake: true, isoLen: 10,
    blurb: 'A long red hood and a V12 under it. Turns heads on Walnut Street.' },
  { id: 'vela-str', name: 'Vela Stradale', price: 50000, kind: 'sport', color: '#e0342a', tile: '#4f5966',
    len: 46, bodyH: 4, cab: [0.3, 0.62], roofH: 3, rearSlope: 2, frontSlope: 2, pillarShift: 1, round: true, intake: true, wing: true,
    stripe: '#f2efe8', goldRims: true, isoLen: 10,
    blurb: 'A race car with a license plate. Too fast for any road in Allegheny County.' },
];

export const rankFor = (hours) => {
  let r = RANKS[0];
  for (const k of RANKS) if (hours >= k.hours) r = k;
  return r;
};

export const nextRank = (hours) => RANKS.find((k) => k.hours > hours) || null;

// Old (v1) ids -> new ids, so existing saves keep their stuff.
export const LEGACY_HOME = {
  dorm: 'pgh-dorm', studio: 'pgh-studio', walkup: 'pgh-townhouse', house: 'pgh-house',
  penthouse: 'pgh-penthouse', mansion: 'pgh-mansion',
};
export const LEGACY_CAR = { sedan: 'wagon' };
