// A tiny 5x7 dot-matrix font, drawn on canvas like a punch-clock display.
const G = {
  '0': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ':': ['.', '.', '#', '.', '#', '.', '.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  c: ['....', '....', '.###', '#...', '#...', '#...', '.###'],
  ' ': ['..', '..', '..', '..', '..', '..', '..'],
};

/**
 * Draw `text` as a dot matrix.
 * opts: cell (px per dot), gap (px between dots), color, ghost (unlit dot color or null), glow
 */
export function dotText(canvas, text, { cell = 10, gap = 2, color = '#ecebe6', ghost = null, glow = 0, pad: padOpt } = {}) {
  const chars = [...text].map((ch) => G[ch] || G[' ']);
  const cols = chars.reduce((s, g) => s + g[0].length, 0) + chars.length - 1;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const pad = padOpt ?? (glow ? Math.ceil(glow / cell) : 0);
  const w = (cols + pad * 2) * cell, h = (7 + pad * 2) * cell;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.aspectRatio = `${w} / ${h}`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  let x0 = pad;
  const size = cell - gap;
  const dots = (lit) => {
    let x = pad;
    for (const g of chars) {
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < g[r].length; c++) {
          const on = g[r][c] === '#';
          if (on === lit && (lit || g !== G[':'])) ctx.fillRect((x + c) * cell, (r + pad) * cell, size, size);
        }
      x += g[0].length + 1;
    }
  };
  if (ghost) {
    ctx.fillStyle = ghost;
    dots(false);
  }
  ctx.fillStyle = color;
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  dots(true);
  ctx.shadowBlur = 0;
  return { cols, pad };
}
