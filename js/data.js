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
  { id: 'pgh-dorm', city: 'pgh', art: 'dorm', name: 'Dorm double, shared bedroom', hood: 'Oakland', price: 0, utilities: 2,
    color: '#b9a68c', tile: '#8f8b84', seed: 3,
    blurb: 'Bathroom down the hall, a roommate who snores, the 61C rattling by all night.' },
  { id: 'pgh-suite', city: 'pgh', art: 'suite', name: 'Dorm suite, shared common room', hood: 'Oakland', price: 120, utilities: 3,
    color: '#a86e55', tile: '#a0937a', seed: 4,
    blurb: 'Your own bedroom, four suitemates, one couch, and a fridge full of labeled leftovers.' },
  { id: 'pgh-dorm-studio', city: 'pgh', art: 'dormstudio', name: 'Studio dorm', hood: 'North Oakland', price: 250, utilities: 4,
    color: '#cfcbc1', tile: '#97a5b4', seed: 6,
    blurb: 'A single with its own kitchenette and bathroom. Nobody else’s alarm clock.' },
  { id: 'pgh-shared-apt', city: 'pgh', art: 'sharedapt', name: 'Shared apartment, 3 roommates', hood: 'South Oakland', price: 450, utilities: 6,
    color: '#8fa3a8', tile: '#77857c', seed: 8,
    blurb: 'Off campus at last. Rent split four ways, a porch, and a war over the thermostat.' },
  { id: 'pgh-studio', city: 'pgh', art: 'studio', name: 'Studio apartment', hood: 'South Oakland', price: 700, utilities: 9,
    color: '#d6d0c4', tile: '#77857c', seed: 5,
    blurb: 'Your own door at last, over a noodle shop. You can see the Cathedral of Learning from bed.' },
  { id: 'pgh-rowhouse', city: 'pgh', art: 'rowhouse', name: 'Lawrenceville rowhouse', hood: 'Lawrenceville', price: 900, utilities: 12,
    color: '#9c4f3a', tile: '#8c6f60', seed: 7,
    blurb: 'Skinny brick rowhouse a block off Butler Street. The coffee shops are all yours.' },
  { id: 'pgh-townhouse', city: 'pgh', art: 'townhouse', name: 'Squirrel Hill townhouse', hood: 'Squirrel Hill', price: 2400, utilities: 20,
    color: '#a8644c', tile: '#a0937a', seed: 9,
    blurb: 'Three floors of brick near Murray Ave, a roof deck, and bagels on Sunday.' },
  { id: 'pgh-house', city: 'pgh', art: 'house', name: 'Shadyside house with a yard', hood: 'Shadyside', price: 6000, utilities: 35,
    color: '#e2d9c8', tile: '#77857c', seed: 11,
    blurb: 'A leafy street off Walnut, a rooftop garden, and a garage for the car.' },
  { id: 'pgh-penthouse', city: 'pgh', art: 'penthouse', name: 'Downtown penthouse', hood: 'Downtown', price: 14000, utilities: 60,
    color: '#93a1ae', tile: '#97a5b4', seed: 13,
    blurb: 'Top floor in the Golden Triangle. Three rivers and a dozen yellow bridges below.' },
  { id: 'pgh-mansion', city: 'pgh', art: 'mansion', name: 'Riverfront mansion', hood: 'Fox Chapel', price: 30000, utilities: 110,
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

// Furniture shows up in the inside view of your place. One of each.
export const FURNITURE = [
  { id: 'plants', name: 'Pothos and a snake plant', price: 30, tile: '#77857c', blurb: 'Hard to kill. You will still worry about them.' },
  { id: 'poster', name: 'Framed bridge print', price: 35, tile: '#8c6f60', blurb: 'One of the 446 bridges, over your bed.' },
  { id: 'rug', name: 'Thrifted rug', price: 45, tile: '#a0937a', blurb: 'From a Squirrel Hill thrift store. Ties the room together.' },
  { id: 'lamp', name: 'Floor lamp', price: 50, tile: '#97a5b4', blurb: 'Warm light for late nights, instead of the overhead.' },
  { id: 'beanbag', name: 'Beanbag chair', price: 60, tile: '#7c5f58', blurb: 'For reading. Or for naps you say are reading.' },
  { id: 'desk', name: 'Study desk', price: 90, tile: '#8f8b84', blurb: 'A real desk with a lamp and a second monitor. Your back thanks you.' },
  { id: 'bookshelf', name: 'Bookshelf', price: 120, tile: '#6f7a8a', blurb: 'Textbooks on the bottom, the good stuff at eye level.' },
  { id: 'espresso', name: 'Espresso machine', price: 260, tile: '#4f5966', blurb: 'Pays for itself in about forty fewer coffee shop trips.' },
  { id: 'tv', name: 'TV and a game console', price: 350, tile: '#5d6672', blurb: 'A reward for locking in. Not a replacement for it.' },
  { id: 'couch', name: 'Couch', price: 500, tile: '#a0937a', blurb: 'Seats three, or one person and a cat.' },
];

// Pets cost money every day to look after.
export const PETS = [
  { id: 'fish', name: 'Betta fish', price: 25, upkeep: 1, tile: '#5d7f8c', blurb: 'A tank on the shelf. Very calming during problem sets.' },
  { id: 'bunny', name: 'Bunny', price: 120, upkeep: 3, tile: '#a0937a', blurb: 'Chews cables. Forgiven immediately.' },
  { id: 'cat', name: 'Rescue cat', price: 150, upkeep: 4, tile: '#8c6f60', blurb: 'Sits on your keyboard exactly when you lock in.' },
  { id: 'dog', name: 'Shelter dog', price: 300, upkeep: 7, tile: '#77857c', blurb: 'Walks to Schenley Park twice a day. Good for both of you.' },
];

// What living costs per day: utilities for your home plus care for each pet.
export function livingCosts(homeId, petIds = []) {
  const home = HOMES.find((h) => h.id === homeId) || HOMES[0];
  const out = [{ label: `Utilities, ${home.name}`, perDay: home.utilities || 0 }];
  for (const id of petIds) {
    const pet = PETS.find((p) => p.id === id);
    if (pet) out.push({ label: `Care for your ${pet.name.toLowerCase()}`, perDay: pet.upkeep });
  }
  return out.filter((c) => c.perDay > 0);
}
export const costPerDay = (homeId, petIds) => livingCosts(homeId, petIds).reduce((a, c) => a + c.perDay, 0);

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
