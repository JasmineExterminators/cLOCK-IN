// Tiny pixel-art engine: a pixel buffer, an isometric box rasterizer,
// and a seeded hash so every building/car looks the same on every render.

export const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const shade = (c, f) =>
  f >= 0
    ? c.map((v) => Math.round(v + (255 - v) * f))
    : c.map((v) => Math.round(v * (1 + f)));

export const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// Deterministic hash -> [0, 1)
export function hash(...n) {
  let h = 2166136261;
  for (const v of n) {
    h ^= (v | 0) + 0x9e3779b9;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
}

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  set(x, y, c, a = 1) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!c || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const d = this.d;
    if (a >= 1 || d[i + 3] === 0) {
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = a >= 1 ? 255 : Math.round(a * 255);
    } else {
      d[i] = d[i] + (c[0] - d[i]) * a;
      d[i + 1] = d[i + 1] + (c[1] - d[i + 1]) * a;
      d[i + 2] = d[i + 2] + (c[2] - d[i + 2]) * a;
      d[i + 3] = Math.max(d[i + 3], Math.round(a * 255));
    }
  }
  rect(x, y, w, h, c, a = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a);
  }
  line(x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  disc(cx, cy, r, colorFn) {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r + r * 0.6) this.set(cx + x, cy + y, colorFn(x, y));
  }
  draw(canvas) {
    canvas.width = this.w;
    canvas.height = this.h;
    canvas.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
  }
}

// 2:1 isometric projection. World x runs down-right, y runs down-left, z up.
export class Iso {
  constructor(pix, ox, oy) {
    this.pix = pix;
    this.ox = ox;
    this.oy = oy;
  }
  p(x, y, z) {
    return [this.ox + 2 * x - 2 * y, this.oy + x + y - z];
  }
  // World coords of a point on the plane z, from screen coords.
  unproject(sx, sy, z) {
    const xmy = (sx - this.ox) / 2;
    const xpy = sy - this.oy + z;
    return [(xpy + xmy) / 2, (xpy - xmy) / 2];
  }
  /**
   * Draw a box. Faces: top, left (faces viewer, runs along x), right (runs along y).
   * Optional per-pixel functions return a color or null for the base color.
   *   topFn(wx, wy, sx, sy)   leftFn(u, v, sx, sy)   rightFn(u, v, sx, sy)
   * u = position along the wall (0 at the front corner side for right; 0 at the far-left for left),
   * v = height above the box bottom (0..h-1).
   */
  box(x, y, z, a, b, h, o) {
    const P = this.pix;
    const top = o.top, left = o.left || shade(top, -0.18), right = o.right || shade(top, -0.34);
    const [tx, ty] = this.p(x, y, z + h);
    const Lx = tx - 2 * b, Ly = ty + b;
    const Bx = tx + 2 * a - 2 * b, By = ty + a + b;
    const Rx = tx + 2 * a;
    const rim = o.rim === false ? null : shade(top, 0.14);
    for (let sx = Lx; sx <= Rx; sx++) {
      const upper = sx < tx ? Ly - Math.floor((sx - Lx) / 2) : ty + Math.floor((sx - tx) / 2);
      const lower = sx < Bx ? Ly + Math.floor((sx - Lx) / 2) : By - Math.floor((sx - Bx) / 2);
      for (let sy = upper; sy <= lower; sy++) {
        let c = top;
        if (o.topFn) {
          const [wx, wy] = this.unproject(sx, sy, z + h);
          c = o.topFn(wx - x, wy - y, sx, sy) || top;
        }
        if (rim && sy === lower) c = rim;
        P.set(sx, sy, c);
      }
      if (h <= 0) continue;
      const isLeft = sx < Bx;
      const u = isLeft ? Math.floor((sx - Lx) / 2) : Math.min(b - 1, Math.floor((sx - Bx) / 2));
      const fn = isLeft ? o.leftFn : o.rightFn;
      let base = isLeft ? left : right;
      for (let r = 1; r <= h; r++) {
        const v = h - r;
        let c = fn ? fn(u, v, sx, lower + r) || base : base;
        if (sx === Bx && o.corner !== false) c = shade(c, 0.1);
        P.set(sx, lower + r, c);
      }
    }
  }
}
