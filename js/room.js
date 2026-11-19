// The inside of your place: a pixel-art room that fills up with the furniture you buy,
// plus pet sprites (in the room, and out in the yard of the outside scene).
import { Pix, Iso, hex, shade, mix, hash } from './pixel.js';
import { PETS } from './data.js';

const C = {
  wood: hex('#8a6a4c'), woodDark: hex('#6d5038'), woodLight: hex('#a5835f'),
  dark: hex('#2a2b2e'), metal: hex('#9aa0a6'), glass: hex('#6f8597'), glassDark: hex('#2b3441'),
  lit: hex('#f2b54a'), litHi: hex('#ffd68a'), screen: hex('#7fb4c4'), screenHi: hex('#c6e6ee'),
  moss: [hex('#55703c'), hex('#6d8b48'), hex('#86a557'), hex('#46602f')],
  pot: hex('#b9603f'), sky: hex('#1f2739'), skyLow: hex('#2c3448'), star: hex('#c8cbd6'), gold: hex('#e8b23a'),
  rug: hex('#9b3f35'), rugEdge: hex('#d9a441'), fabric: hex('#5d6f86'), cushion: hex('#71839a'),
  bean: hex('#c0503e'), water: hex('#5fa3b5'), shadow: hex('#000000'),
};

/* ---------- sprites ---------- */

const PALETTE = {
  o: '#d98c3f', d: '#a8652a', e: '#1c1d20', w: '#efe6d6', g: '#c9c1b3', b: '#8b5a3c', n: '#5e3a24', p: '#e6a0a0', f: '#f08a3c',
  k: '#141416', c: '#d9783a', y: '#dcae55', Y: '#b07f2f', s: '#8a919a', S: '#4c5259', r: '#9a4a2a', R: '#6a2f17',
};
const SPRITES = {
  cat: ['.o..o..', '.oooo..', '.eooe..', 'oooooo.', 'oddooo.', 'o.o.oo.'],
  dog: ['nn.......', 'nbbn.....', 'nebbbbbb.', '.bbbbbbbb', '.b.b..b.b', '.b.b..b.b'],
  bunny: ['.w.w.', '.p.p.', '.w.w.', 'wwww.', 'wewwg', '.wwwg'],
  // dog breeds, all facing left
  corgi: ['.c.c......', '.ccc......', 'kewcccccc.', '.wwccccccc', '..wwwwwww.', '..c.c..c.c'],
  golden: ['.yyy.......', 'kyeY.......', '.yyYyyyyyy.', '..yyyyyyyyY', '..yyyyyyyy.', '..y.y..y.y.', '..Y.Y..Y.Y.'],
  husky: ['.S.S.....S', '.sss.....S', 'kwesSSSSSS', '.wwsssssss', '..wwwwwww.', '..w.w..w.w', '..w.w..w.w'],
  dachshund: ['RR..........', 'RrrR........', 'kerrrrrrrrr.', '.rrrrrrrrrrR', '.r.r.....r.r'],
  poodle: ['.ww.......', 'wwww.....w', 'kwewg...ww', '..wwwwwww.', '..gwwwwwg.', '..w.....w.', '..w.....w.', '.ww....ww.'],
};
const DOGS = PETS.filter((p) => p.dog).map((p) => p.id);
// Where dogs stand, in floor coordinates: inside the room, and out in the yard.
const ROOM_DOG_SPOTS = [[20, 19], [9, 20], [25, 12], [12, 6], [24, 18], [6, 15]];
const YARD_DOG_SPOTS = [[12, 20], [4, 13], [22, 22], [17, 23], [3, 20], [26, 17]];
function drawSprite(P, name, sx, sy, flip = false, k = 1) {
  const rows = SPRITES[name];
  const h = rows.length * k, w = rows[0].length * k;
  const left = sx - Math.floor(w / 2);
  // soft shadow
  for (let x = -1; x <= w; x++) for (let j = 1; j <= k; j++) P.set(left + x, sy + j, C.shadow, 0.25);
  rows.forEach((row, r) => {
    [...row].forEach((ch, i) => {
      if (ch === '.') return;
      const x = flip ? row.length - 1 - i : i;
      for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) P.set(left + x * k + dx, sy - h + 1 + r * k + dy, hex(PALETTE[ch]));
    });
  });
}

/* ---------- furniture pieces (x, y, z = back-left corner on the floor) ---------- */

const PIECES = {
  desk(iso, x, y, z, light) {
    iso.box(x, y, z, 7, 3, 4, { top: C.wood, left: C.woodDark, right: shade(C.woodDark, -0.2), rim: false });
    // two monitors
    for (const mx of [x + 1, x + 4]) {
      iso.box(mx, y, z + 4, 2, 1, 3, { top: C.dark, left: C.dark, right: C.dark,
        leftFn: (u, v) => (v >= 1 && u >= 0 ? (light > 0.5 ? (v === 2 ? C.screenHi : C.screen) : C.glassDark) : null) });
    }
    // chair
    iso.box(x + 3, y + 4, z, 2, 2, 2, { top: C.dark, left: shade(C.dark, 0.1) });
    iso.box(x + 3, y + 5, z + 2, 2, 1, 3, { top: C.dark, left: shade(C.dark, 0.15) });
  },
  bookshelf(iso, x, y, z) {
    const spines = [hex('#c0503e'), hex('#5d6f86'), hex('#d9a441'), hex('#7f9e8c'), hex('#efe6d6'), hex('#8b5a44')];
    iso.box(x, y, z, 2, 6, 12, {
      top: C.wood, left: C.woodDark, right: C.woodDark,
      rightFn: (u, v) => {
        if (v % 4 === 0) return C.woodLight; // shelves
        if (u === 0 || u === 5) return null;
        return hash(u, Math.floor(v / 4), 7) < 0.85 ? spines[Math.floor(hash(u, v >> 2, 3) * spines.length)] : null;
      },
    });
  },
  plants(iso, x, y, z) {
    iso.box(x, y, z, 2, 2, 2, { top: hex('#4a3a2c'), left: C.pot, right: shade(C.pot, -0.2) });
    const [sx, sy] = iso.p(x + 1, y + 1, z + 2);
    iso.pix.disc(sx, sy - 4, 4, (dx, dy) => (hash(dx, dy, 5) < 0.85 ? C.moss[Math.floor(hash(dy, dx, 2) * 4)] : null));
    for (let i = 0; i < 4; i++) iso.pix.set(sx - 1 + i, sy - 9 - (i % 2), C.moss[2]);
  },
  lamp(iso, x, y, z, light) {
    const [sx, sy] = iso.p(x, y, z);
    for (let i = 0; i < 16; i++) iso.pix.set(sx, sy - i, hex('#3b3e44'));
    iso.pix.rect(sx - 2, sy, 5, 1, hex('#3b3e44'));
    const on = light > 0.5;
    for (let r = 0; r < 4; r++) for (let dx = -2 - (r >> 1); dx <= 2 + (r >> 1); dx++) iso.pix.set(sx + dx, sy - 19 + r, on ? (r === 3 ? C.litHi : C.lit) : hex('#d8cdb8'));
    if (on) for (let dy = -6; dy <= 14; dy++) for (let dx = -12; dx <= 12; dx++) {
      const d = Math.hypot(dx, dy * 1.3);
      if (d < 13) iso.pix.set(sx + dx, sy - 12 + dy, C.lit, 0.07 * (1 - d / 13));
    }
  },
  beanbag(iso, x, y, z) {
    const [sx, sy] = iso.p(x + 1.5, y + 1.5, z);
    iso.pix.disc(sx, sy - 3, 5, (dx, dy) => (dy < -2 ? shade(C.bean, 0.12) : dy > 2 ? shade(C.bean, -0.25) : C.bean));
  },
  couch(iso, x, y, z) {
    iso.box(x, y, z, 9, 4, 2, { top: C.cushion, left: C.fabric, right: shade(C.fabric, -0.2), topFn: (wx) => (Math.floor(wx) % 3 === 0 ? shade(C.cushion, -0.1) : null) });
    iso.box(x, y + 3, z + 2, 9, 1, 3, { top: C.cushion, left: shade(C.fabric, 0.05) });
    iso.box(x, y, z + 2, 1, 3, 2, { top: C.cushion, right: shade(C.fabric, -0.15) });
    iso.box(x + 8, y, z + 2, 1, 3, 2, { top: C.cushion, right: shade(C.fabric, -0.15) });
  },
  tvstand(iso, x, y, z, light) {
    iso.box(x, y, z, 7, 2, 3, { top: C.woodDark, left: shade(C.woodDark, -0.1), leftFn: (u, v) => (v === 1 && u % 3 === 1 ? C.dark : null) });
    // console with a light
    const [sx, sy] = iso.p(x + 5, y + 1, z + 3);
    iso.pix.rect(sx - 2, sy - 2, 4, 2, hex('#e8e8ea'));
    iso.pix.set(sx + 1, sy - 2, light > 0.5 ? hex('#7fd0e0') : hex('#8a9096'));
  },
  espresso(iso, x, y, z) {
    iso.box(x, y, z, 3, 3, 5, { top: hex('#cfcbc1'), left: hex('#b9b3a6'), right: hex('#9d978b') });
    iso.box(x, y, z + 5, 2, 2, 3, { top: C.metal, left: shade(C.metal, -0.1), right: shade(C.metal, -0.3),
      leftFn: (u, v) => (v === 0 ? C.dark : null) });
    const [sx, sy] = iso.p(x + 2, y + 2, z + 5);
    iso.pix.rect(sx - 1, sy - 2, 2, 2, hex('#efe6d6'));
  },
  fishtank(iso, x, y, z) {
    iso.box(x, y, z, 3, 2, 3, { top: hex('#a6d4dd'), left: C.water, right: shade(C.water, -0.2),
      leftFn: (u, v) => (u === 1 && v === 1 ? hex('#f08a3c') : v === 0 ? hex('#d8c9a8') : null) });
  },
};

/* ---------- the room ---------- */

/** Draw the room for a home with the given furniture and pets. light: 0..1 (on the clock = bright). */
export function renderRoom(home, furniture = [], pets = [], { working = false } = {}) {
  const W = 120, H = 90; // same 4:3 shape as the outside scene, drawn larger
  const P = new Pix(W, H);
  const has = (id) => furniture.includes(id);
  const light = working ? 0.95 : 0.3;
  // backdrop
  const bgTop = hex('#191c23'), bgBot = hex('#22262f');
  for (let y = 0; y < H; y++) { const c = mix(bgTop, bgBot, y / H); for (let x = 0; x < W; x++) P.set(x, y, c); }

  const a = 28, b = 22, WH = 22;
  const iso = new Iso(P, W / 2 - (a - b), 31);
  const wall = mix(hex(home.color || '#d6d0c4'), hex('#e8e0d2'), 0.45);
  const floorA = hex('#9c7a57'), floorB = hex('#8f6f4f');

  // floor, with the rug painted on if owned
  iso.box(0, 0, 0, a, b, 2, {
    top: floorA, left: shade(floorA, -0.3), right: shade(floorA, -0.45), rim: false,
    topFn: (wx, wy) => {
      if (has('rug') && wx > 9 && wx < 22 && wy > 8 && wy < 18) {
        const edge = wx < 10 || wx > 21 || wy < 9 || wy > 17;
        return edge ? C.rugEdge : (Math.floor(wx) + Math.floor(wy)) % 4 === 0 ? shade(C.rug, 0.15) : C.rug;
      }
      return Math.floor(wy / 2) % 2 ? floorB : (Math.floor(wx + (Math.floor(wy / 2) % 3) * 3) % 9 === 0 ? shade(floorA, -0.12) : null);
    },
  });

  // back-right wall (runs along x): window, TV screen, baseboard
  iso.box(0, 0, 2, a, 1, WH, {
    top: shade(wall, -0.2), left: wall, right: wall, rim: false,
    leftFn: (u, v) => {
      if (v === 0) return shade(wall, -0.3);
      if (u >= 4 && u <= 10 && v >= 9 && v <= 18) { // window with the night outside
        if (u === 4 || u === 10 || v === 9 || v === 18 || u === 7) return hex('#e8e0d2');
        if (v <= 11) return hash(u, v, 3) < 0.4 ? mix(C.skyLow, C.lit, 0.5) : C.skyLow; // lit windows across the street
        return hash(u, v, 9) < 0.06 ? C.star : C.sky;
      }
      if (has('tv') && u >= 14 && u <= 21 && v >= 9 && v <= 14) {
        if (u === 14 || u === 21 || v === 9 || v === 14) return C.dark;
        return light > 0.5 ? ((u + v) % 5 === 0 ? C.screenHi : C.screen) : C.glassDark;
      }
      return null;
    },
  });
  // back-left wall (runs along y): the framed bridge print
  iso.box(0, 0, 2, 1, b, WH, {
    top: shade(wall, -0.2), right: shade(wall, -0.12), left: wall, rim: false,
    rightFn: (u, v) => {
      if (v === 0) return shade(wall, -0.4);
      if (has('poster') && u >= 9 && u <= 15 && v >= 10 && v <= 16) {
        if (u === 9 || u === 15 || v === 10 || v === 16) return C.dark;
        if (v === 12) return C.gold;
        if ((u === 11 || u === 13) && v > 12) return C.gold;
        return v > 12 ? hex('#2c4a5e') : hex('#3a4660');
      }
      return null;
    },
  });

  // furniture, back to front
  const placed = [];
  if (has('desk')) placed.push([3, 1, 'desk']);
  if (has('bookshelf')) placed.push([1, 3, 'bookshelf']);
  if (has('tv')) placed.push([14, 1, 'tvstand']);
  if (has('espresso')) placed.push([24, 1, 'espresso']);
  if (pets.includes('fish')) placed.push(has('bookshelf') ? [1, 5, 'fishtank', 12] : [24, 6, 'fishtank']);
  if (has('lamp')) placed.push([22, 5, 'lamp']);
  if (has('plants')) placed.push([1, 17, 'plants']);
  if (has('beanbag')) placed.push([4, 11, 'beanbag']);
  if (has('couch')) placed.push([13, 13, 'couch']);
  placed.sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
  for (const [x, y, name, dz = 0] of placed) PIECES[name](iso, x, y, 2 + dz, light);

  // pets
  if (pets.includes('cat')) {
    const [sx, sy] = has('couch') ? iso.p(16, 15, 6) : iso.p(14, 12, 2);
    drawSprite(P, 'cat', sx, sy);
  }
  if (pets.includes('bunny')) { const [sx, sy] = iso.p(5, 18, 2); drawSprite(P, 'bunny', sx, sy); }
  DOGS.filter((d) => pets.includes(d))
    .map((d, i) => [d, ...ROOM_DOG_SPOTS[i % ROOM_DOG_SPOTS.length], i])
    .sort((p, q) => p[1] + p[2] - (q[1] + q[2]))
    .forEach(([d, x, y, i]) => { const [sx, sy] = iso.p(x, y, 2); drawSprite(P, d, sx, sy, i % 2 === 0); });

  // the room is dimmer off the clock
  if (!working) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) P.set(x, y, hex('#0e1018'), 0.18);
  return P;
}

/** Pets out in the yard of the outside scene (same layout numbers as renderScene in art.js). */
export function drawYardPets(P, pets = []) {
  const a = 28, b = 24;
  const iso = new Iso(P, P.w / 2 - (a - b), P.h - (a + b) - 9);
  if (pets.includes('cat')) { const [sx, sy] = iso.p(24, 12, 5); drawSprite(P, 'cat', sx, sy, true); }
  if (pets.includes('bunny')) { const [sx, sy] = iso.p(8, 21, 5); drawSprite(P, 'bunny', sx, sy); }
  DOGS.filter((d) => pets.includes(d))
    .map((d, i) => [d, ...YARD_DOG_SPOTS[i % YARD_DOG_SPOTS.length], i])
    .sort((p, q) => p[1] + p[2] - (q[1] + q[2]))
    .forEach(([d, x, y, i]) => { const [sx, sy] = iso.p(x, y, 5); drawSprite(P, d, sx, sy, i % 2 === 1); });
  return P;
}

/** Shop tile for a piece of furniture or a pet, shown in a small corner of a room. */
export function renderItemTile(kind, id) {
  const W = 58, H = 58;
  const P = new Pix(W, H);
  const a = 14, b = 12, WH = 14;
  const iso = new Iso(P, W / 2 - (a - b), 23);
  const wall = hex('#d8d0c2');
  iso.box(0, 0, 0, a, b, 2, { top: hex('#9c7a57'), left: hex('#6d553c'), right: hex('#5a4532'), rim: false,
    topFn: (wx, wy) => (Math.floor(wy / 2) % 2 ? hex('#8f6f4f') : null) });
  const poster = id === 'poster', tv = id === 'tv';
  iso.box(0, 0, 2, a, 1, WH, { top: shade(wall, -0.2), left: wall, rim: false,
    leftFn: (u, v) => {
      if (v === 0) return shade(wall, -0.3);
      if (tv && u >= 3 && u <= 10 && v >= 6 && v <= 11) return u === 3 || u === 10 || v === 6 || v === 11 ? C.dark : (u + v) % 5 === 0 ? C.screenHi : C.screen;
      if (poster && u >= 4 && u <= 9 && v >= 5 && v <= 11) {
        if (u === 4 || u === 9 || v === 5 || v === 11) return C.dark;
        if (v === 7 || ((u === 6 || u === 8) && v > 7)) return C.gold;
        return v > 7 ? hex('#2c4a5e') : hex('#3a4660');
      }
      return null;
    } });
  iso.box(0, 0, 2, 1, b, WH, { top: shade(wall, -0.2), right: shade(wall, -0.12), rim: false, rightFn: (u, v) => (v === 0 ? shade(wall, -0.4) : null) });
  const at = {
    desk: [3, 2], bookshelf: [1, 3], plants: [5, 5], lamp: [7, 6], beanbag: [5, 5], couch: [2, 5], tv: [3, 1, 'tvstand'],
    espresso: [5, 3], rug: null, poster: null,
  };
  if (kind === 'furniture') {
    if (id === 'rug') {
      iso.box(2, 2, 2, 10, 8, 0, { top: C.rug, rim: false, topFn: (wx, wy) => (wx < 1 || wx > 9 || wy < 1 || wy > 7 ? C.rugEdge : (Math.floor(wx) + Math.floor(wy)) % 4 === 0 ? shade(C.rug, 0.15) : null) });
    } else if (at[id]) {
      const [x, y, piece = id] = at[id];
      PIECES[piece](iso, x, y, 2, 0.9);
    }
  } else {
    if (id === 'fish') PIECES.fishtank(iso, 5, 4, 2);
    else { const [sx, sy] = iso.p(8, 8, 2); drawSprite(P, id, sx, sy, false, 2); }
  }
  return P;
}
