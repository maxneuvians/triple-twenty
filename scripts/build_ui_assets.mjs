import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { deflateSync } from "node:zlib";

const out = {
  panels: "src/assets/ui/panels.png",
  cardFronts: "src/assets/cards/card-fronts.png",
  cardFrames: "src/assets/cards/card-frames.png",
  cardIcons: "src/assets/cards/card-icons.png"
};

function rgba(hex, alpha = 255) {
  return [
    (hex >> 16) & 255,
    (hex >> 8) & 255,
    hex & 255,
    alpha
  ];
}

function makeCanvas(width, height, fill = [0, 0, 0, 0]) {
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = fill[0];
    data[index + 1] = fill[1];
    data[index + 2] = fill[2];
    data[index + 3] = fill[3];
  }
  return { width, height, data };
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const index = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  canvas.data[index] = color[0];
  canvas.data[index + 1] = color[1];
  canvas.data[index + 2] = color[2];
  canvas.data[index + 3] = color[3];
}

function fillRect(canvas, x, y, w, h, color) {
  for (let yy = Math.floor(y); yy < Math.floor(y + h); yy += 1) {
    for (let xx = Math.floor(x); xx < Math.floor(x + w); xx += 1) {
      setPixel(canvas, xx, yy, color);
    }
  }
}

function strokeRect(canvas, x, y, w, h, color, thickness = 1) {
  for (let t = 0; t < thickness; t += 1) {
    fillRect(canvas, x + t, y + t, w - t * 2, 1, color);
    fillRect(canvas, x + t, y + h - 1 - t, w - t * 2, 1, color);
    fillRect(canvas, x + t, y + t, 1, h - t * 2, color);
    fillRect(canvas, x + w - 1 - t, y + t, 1, h - t * 2, color);
  }
}

function line(canvas, x0, y0, x1, y1, color, thickness = 1) {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = Math.floor(x0);
  let y = Math.floor(y0);
  while (true) {
    fillRect(canvas, x - Math.floor(thickness / 2), y - Math.floor(thickness / 2), thickness, thickness, color);
    if (x === Math.floor(x1) && y === Math.floor(y1)) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function fillCircle(canvas, cx, cy, radius, color) {
  const r2 = radius * radius;
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (x * x + y * y <= r2) setPixel(canvas, cx + x, cy + y, color);
    }
  }
}

function strokeCircle(canvas, cx, cy, radius, color, thickness = 1) {
  for (let r = radius; r > radius - thickness; r -= 1) {
    const r2 = r * r;
    const inner = (r - 1) * (r - 1);
    for (let y = -r; y <= r; y += 1) {
      for (let x = -r; x <= r; x += 1) {
        const d = x * x + y * y;
        if (d <= r2 && d >= inner) setPixel(canvas, cx + x, cy + y, color);
      }
    }
  }
}

function fillPolygon(canvas, points, color) {
  const ys = points.map((p) => p[1]);
  const minY = Math.floor(Math.min(...ys));
  const maxY = Math.ceil(Math.max(...ys));
  for (let y = minY; y <= maxY; y += 1) {
    const nodes = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if ((yi < y && yj >= y) || (yj < y && yi >= y)) {
        nodes.push(Math.floor(xi + ((y - yi) / (yj - yi)) * (xj - xi)));
      }
    }
    nodes.sort((a, b) => a - b);
    for (let i = 0; i < nodes.length; i += 2) {
      if (nodes[i + 1] === undefined) break;
      fillRect(canvas, nodes[i], y, nodes[i + 1] - nodes[i] + 1, 1, color);
    }
  }
}

function strokePolygon(canvas, points, color, thickness = 1) {
  for (let index = 0; index < points.length; index += 1) {
    const next = (index + 1) % points.length;
    line(canvas, points[index][0], points[index][1], points[next][0], points[next][1], color, thickness);
  }
}

function drawPanel(canvas, x, y, w, h, opts = {}) {
  const fill = opts.fill ?? rgba(0x0b1010, 224);
  const trim = opts.trim ?? rgba(0xc78b35, 255);
  const dark = opts.dark ?? rgba(0x050606, 238);
  const inner = opts.inner ?? rgba(0x233027, 140);
  fillRect(canvas, x, y, w, h, dark);
  fillRect(canvas, x + 4, y + 4, w - 8, h - 8, fill);
  strokeRect(canvas, x, y, w, h, rgba(0x050505, 255), 3);
  strokeRect(canvas, x + 4, y + 4, w - 8, h - 8, trim, 2);
  strokeRect(canvas, x + 9, y + 9, w - 18, h - 18, inner, 1);
  fillRect(canvas, x + 8, y + 8, 18, 4, trim);
  fillRect(canvas, x + 8, y + 8, 4, 18, trim);
  fillRect(canvas, x + w - 26, y + 8, 18, 4, trim);
  fillRect(canvas, x + w - 12, y + 8, 4, 18, trim);
  fillRect(canvas, x + 8, y + h - 12, 18, 4, trim);
  fillRect(canvas, x + 8, y + h - 26, 4, 18, trim);
  fillRect(canvas, x + w - 26, y + h - 12, 18, 4, trim);
  fillRect(canvas, x + w - 12, y + h - 26, 4, 18, trim);
}

function savePng(path, canvas) {
  mkdirSync(dirname(path), { recursive: true });
  const rows = [];
  for (let y = 0; y < canvas.height; y += 1) {
    rows.push(Buffer.from([0]));
    rows.push(Buffer.from(canvas.data.slice(y * canvas.width * 4, (y + 1) * canvas.width * 4)));
  }
  const png = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr(canvas.width, canvas.height)),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0))
  ];
  writeFileSync(path, Buffer.concat(png));
}

function ihdr(width, height) {
  const b = Buffer.alloc(13);
  b.writeUInt32BE(width, 0);
  b.writeUInt32BE(height, 4);
  b[8] = 8;
  b[9] = 6;
  b[10] = 0;
  b[11] = 0;
  b[12] = 0;
  return b;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (~crc) >>> 0;
}

function buildPanels() {
  const c = makeCanvas(1280, 720);
  drawPanel(c, 14, 14, 210, 140, { trim: rgba(0xa3582b, 255), inner: rgba(0x3f834e, 150) });
  drawPanel(c, 14, 166, 210, 74, { trim: rgba(0xa3582b, 255) });
  drawPanel(c, 30, 268, 158, 88, { trim: rgba(0x8c5a25, 255) });
  drawPanel(c, 672, 32, 132, 178, { trim: rgba(0x9f5f20, 255), inner: rgba(0x344b31, 140) });
  drawPanel(c, 966, 14, 300, 144, { trim: rgba(0x284f64, 255), inner: rgba(0x2f6a82, 150) });
  drawPanel(c, 986, 168, 280, 114, { trim: rgba(0x6c5a35, 255), inner: rgba(0x555d44, 150) });
  drawPanel(c, 986, 292, 280, 108, { trim: rgba(0x6c5a35, 255), inner: rgba(0x435c32, 150) });
  drawPanel(c, 700, 258, 270, 142, { trim: rgba(0x5d4632, 255), inner: rgba(0x355560, 130) });
  drawPanel(c, 8, 446, 966, 204, { fill: rgba(0x0a472d, 225), trim: rgba(0x8e4d22, 255), inner: rgba(0x2c7a51, 150) });
  drawPanel(c, 984, 446, 282, 204, { trim: rgba(0x305a66, 255), inner: rgba(0x344d55, 150) });
  drawPanel(c, 8, 658, 966, 52, { trim: rgba(0x77502a, 255), inner: rgba(0x274130, 150) });
  drawPanel(c, 984, 658, 282, 52, { trim: rgba(0x77502a, 255) });
  fillRect(c, 0, 442, 1280, 4, rgba(0xc47a2b, 255));
  fillRect(c, 0, 650, 1280, 3, rgba(0x26110b, 255));
  fillRect(c, 1000, 500, 104, 120, rgba(0x101515, 230));
  strokeRect(c, 1000, 500, 104, 120, rgba(0xc78b35, 255), 2);
  fillRect(c, 1130, 500, 104, 120, rgba(0x101515, 175));
  strokeRect(c, 1130, 500, 104, 120, rgba(0x565047, 255), 2);
  return c;
}

function drawCardFrame(canvas, frame, colors) {
  const w = 156;
  const h = 198;
  const x = frame * w;
  fillRect(canvas, x, 0, w, h, rgba(0x050506, 0));
  fillRect(canvas, x + 6, 4, w - 12, h - 8, rgba(0x070b0b, 255));
  fillRect(canvas, x + 10, 8, w - 20, h - 16, colors.shadow);
  fillRect(canvas, x + 14, 12, w - 28, h - 24, colors.body);
  fillRect(canvas, x + 18, 16, w - 36, 34, colors.header);
  fillRect(canvas, x + 18, 132, w - 36, 48, colors.textBox);
  strokeRect(canvas, x + 8, 6, w - 16, h - 12, rgba(0xf2d18a, 255), 3);
  strokeRect(canvas, x + 15, 13, w - 30, h - 26, rgba(0x2e2117, 210), 2);
  strokeRect(canvas, x + 21, 19, w - 42, 22, rgba(0xffffcf, 85), 1);
  fillRect(canvas, x + 13, 168, 12, 12, colors.gem);
  strokeRect(canvas, x + 15, 170, 8, 8, rgba(0xf5dc8b, 255), 1);
  for (let xx = x + 17; xx < x + w - 17; xx += 9) {
    setPixel(canvas, xx, 187, rgba(0xf2d18a, 180));
  }
}

function buildCardFrames() {
  const c = makeCanvas(156 * 4, 198);
  drawCardFrame(c, 0, {
    body: rgba(0x2e8b3f, 255),
    header: rgba(0x155328, 255),
    shadow: rgba(0x082411, 255),
    textBox: rgba(0xb8d36d, 230),
    gem: rgba(0x7ccf78, 255)
  });
  drawCardFrame(c, 1, {
    body: rgba(0x5b247a, 255),
    header: rgba(0x321748, 255),
    shadow: rgba(0x16091f, 255),
    textBox: rgba(0x34224a, 230),
    gem: rgba(0x9570d1, 255)
  });
  drawCardFrame(c, 2, {
    body: rgba(0x145a68, 255),
    header: rgba(0x0a3340, 255),
    shadow: rgba(0x051820, 255),
    textBox: rgba(0x1d7180, 230),
    gem: rgba(0x65b4c9, 255)
  });
  drawCardFrame(c, 3, {
    body: rgba(0xe3bf57, 255),
    header: rgba(0x99732b, 255),
    shadow: rgba(0x3a2910, 255),
    textBox: rgba(0xf5dc8b, 235),
    gem: rgba(0xf0b632, 255)
  });
  return c;
}

function buildIcons() {
  const c = makeCanvas(64 * 8, 64);
  const white = rgba(0xf5e7b8, 255);
  const dark = rgba(0x16100c, 255);
  const red = rgba(0xb72e2e, 255);
  const green = rgba(0x178251, 255);
  const blue = rgba(0x5db1d6, 255);
  const gold = rgba(0xe7bd54, 255);
  const grey = rgba(0x9d9683, 255);

  const ox = (i) => i * 64;
  strokeCircle(c, ox(0) + 32, 32, 23, dark, 8);
  strokeCircle(c, ox(0) + 32, 32, 15, white, 7);
  fillCircle(c, ox(0) + 32, 32, 7, red);
  fillCircle(c, ox(0) + 32, 32, 3, white);

  fillCircle(c, ox(1) + 32, 32, 24, white);
  fillPolygon(c, [[ox(1) + 32, 32], [ox(1) + 12, 12], [ox(1) + 52, 20]], dark);
  fillPolygon(c, [[ox(1) + 32, 32], [ox(1) + 52, 20], [ox(1) + 50, 52]], green);
  fillPolygon(c, [[ox(1) + 32, 32], [ox(1) + 12, 12], [ox(1) + 16, 52]], rgba(0xf2d18a, 255));
  strokeCircle(c, ox(1) + 32, 32, 25, dark, 3);
  line(c, ox(1) + 16, 16, ox(1) + 50, 50, red, 4);

  fillPolygon(c, [[ox(2) + 15, 33], [ox(2) + 37, 12], [ox(2) + 37, 25], [ox(2) + 51, 25], [ox(2) + 51, 41], [ox(2) + 37, 41], [ox(2) + 37, 54]], gold);
  strokeRect(c, ox(2) + 14, 25, 38, 17, dark, 2);
  fillPolygon(c, [[ox(3) + 49, 33], [ox(3) + 27, 12], [ox(3) + 27, 25], [ox(3) + 13, 25], [ox(3) + 13, 41], [ox(3) + 27, 41], [ox(3) + 27, 54]], gold);
  strokeRect(c, ox(3) + 12, 25, 38, 17, dark, 2);

  line(c, ox(4) + 12, 20, ox(4) + 52, 10, grey, 5);
  line(c, ox(4) + 14, 45, ox(4) + 54, 36, grey, 5);
  line(c, ox(4) + 25, 8, ox(4) + 42, 56, dark, 4);
  line(c, ox(4) + 28, 8, ox(4) + 45, 56, rgba(0xf5e7b8, 180), 1);

  strokeCircle(c, ox(5) + 32, 32, 21, white, 3);
  line(c, ox(5) + 32, 8, ox(5) + 32, 56, white, 3);
  line(c, ox(5) + 8, 32, ox(5) + 56, 32, white, 3);
  fillCircle(c, ox(5) + 32, 32, 5, gold);

  fillPolygon(c, [[ox(6) + 32, 8], [ox(6) + 52, 17], [ox(6) + 48, 42], [ox(6) + 32, 57], [ox(6) + 16, 42], [ox(6) + 12, 17]], rgba(0x2d6b72, 255));
  strokeCircle(c, ox(6) + 32, 31, 18, white, 2);
  fillCircle(c, ox(6) + 32, 32, 7, rgba(0xf2d18a, 255));

  fillCircle(c, ox(7) + 24, 25, 12, red);
  fillCircle(c, ox(7) + 40, 25, 12, red);
  fillPolygon(c, [[ox(7) + 13, 29], [ox(7) + 51, 29], [ox(7) + 32, 55]], red);
  strokeCircle(c, ox(7) + 24, 25, 13, dark, 2);
  strokeCircle(c, ox(7) + 40, 25, 13, dark, 2);
  line(c, ox(7) + 16, 32, ox(7) + 32, 55, dark, 2);
  line(c, ox(7) + 48, 32, ox(7) + 32, 55, dark, 2);
  return c;
}

const cardSpecs = [
  {
    name: "Clean Hit",
    body: 0x2e8b3f,
    header: 0x155328,
    bottom: 0xb8d36d,
    accent: 0x7ccf78,
    icon: "target"
  },
  {
    name: "Fat Segment",
    body: 0xe3bf57,
    header: 0x99732b,
    bottom: 0xf5dc8b,
    accent: 0xf0b632,
    icon: "fat"
  },
  {
    name: "Drift Left",
    body: 0x145a68,
    header: 0x0a3340,
    bottom: 0x1d7180,
    accent: 0x65b4c9,
    icon: "left"
  },
  {
    name: "Drift Right",
    body: 0x145a68,
    header: 0x0a3340,
    bottom: 0x1d7180,
    accent: 0x65b4c9,
    icon: "right"
  },
  {
    name: "Wire",
    body: 0xa02620,
    header: 0x5f1613,
    bottom: 0xd34a31,
    accent: 0xe25f44,
    icon: "wire"
  },
  {
    name: "Focus",
    body: 0x5b247a,
    header: 0x321748,
    bottom: 0x34224a,
    accent: 0x9570d1,
    icon: "focus"
  },
  {
    name: "Safe Setup",
    body: 0x1d6f78,
    header: 0x0d3c45,
    bottom: 0x255f69,
    accent: 0x72c4c5,
    icon: "shield"
  },
  {
    name: "Checkout Nerve",
    body: 0xd8b447,
    header: 0x8f6a24,
    bottom: 0xf2d18a,
    accent: 0xd94b32,
    icon: "heart"
  }
];

function drawCardTexture(canvas, x, y, w, h, base, accent) {
  fillRect(canvas, x, y, w, h, rgba(base, 255));
}

function drawCardFront(canvas, frame, spec) {
  const w = 156;
  const h = 198;
  const x = frame * w;
  const gold = rgba(0xf2d18a, 255);
  const dark = rgba(0x080a09, 255);
  const shadow = rgba(0x000000, 180);

  fillRect(canvas, x, 0, w, h, rgba(0x050506, 0));
  fillRect(canvas, x + 4, 4, w - 7, h - 5, shadow);
  fillRect(canvas, x + 7, 5, w - 14, h - 10, dark);
  drawCardTexture(canvas, x + 12, 10, w - 24, h - 20, spec.body, spec.accent);
  fillRect(canvas, x + 18, 16, w - 36, 30, rgba(spec.header, 238));
  fillRect(canvas, x + 18, 136, w - 36, 44, rgba(spec.bottom, 238));
  fillRect(canvas, x + 20, 18, w - 40, 1, rgba(0xffffcf, 95));
  fillRect(canvas, x + 20, 138, w - 40, 1, rgba(0xffffcf, 70));

  strokeRect(canvas, x + 7, 5, w - 14, h - 10, rgba(0x15100a, 255), 2);
  strokeRect(canvas, x + 10, 8, w - 20, h - 16, gold, 3);
  strokeRect(canvas, x + 16, 14, w - 32, h - 28, rgba(0x2c2115, 210), 2);
  strokeRect(canvas, x + 21, 19, w - 42, 20, rgba(0xffffcf, 95), 1);
  strokeRect(canvas, x + 21, 139, w - 42, 36, rgba(0x1e160f, 115), 1);
  fillRect(canvas, x + 13, 168, 12, 12, rgba(spec.accent, 255));
  strokeRect(canvas, x + 15, 170, 8, 8, gold, 1);

  fillRect(canvas, x + 13, 9, 18, 4, gold);
  fillRect(canvas, x + 13, 9, 4, 18, gold);
  fillRect(canvas, x + w - 31, 9, 18, 4, gold);
  fillRect(canvas, x + w - 17, 9, 4, 18, gold);
  fillRect(canvas, x + 13, h - 13, 18, 4, gold);
  fillRect(canvas, x + 13, h - 27, 4, 18, gold);
  fillRect(canvas, x + w - 31, h - 13, 18, 4, gold);
  fillRect(canvas, x + w - 17, h - 27, 4, 18, gold);

  drawLargeCardIcon(canvas, x + 78, 94, spec.icon, spec.accent);
}

function drawLargeCardIcon(canvas, cx, cy, icon, accentHex) {
  const white = rgba(0xf5e7b8, 255);
  const dark = rgba(0x16100c, 255);
  const red = rgba(0xb72e2e, 255);
  const green = rgba(0x178251, 255);
  const gold = rgba(0xe7bd54, 255);
  const grey = rgba(0x9d9683, 255);
  const accent = rgba(accentHex, 255);

  if (icon === "target") {
    strokeCircle(canvas, cx, cy, 32, dark, 8);
    strokeCircle(canvas, cx, cy, 23, white, 7);
    strokeCircle(canvas, cx, cy, 13, dark, 6);
    fillCircle(canvas, cx, cy, 8, red);
    fillCircle(canvas, cx, cy, 3, white);
    return;
  }

  if (icon === "fat") {
    fillCircle(canvas, cx, cy, 33, white);
    fillPolygon(canvas, [[cx, cy], [cx - 29, cy - 28], [cx + 31, cy - 20]], dark);
    fillPolygon(canvas, [[cx, cy], [cx + 31, cy - 20], [cx + 28, cy + 30]], green);
    fillPolygon(canvas, [[cx, cy], [cx - 29, cy - 28], [cx - 24, cy + 30]], rgba(0xf2d18a, 255));
    strokeCircle(canvas, cx, cy, 33, dark, 3);
    line(canvas, cx - 27, cy - 25, cx + 28, cy + 28, red, 5);
    line(canvas, cx - 25, cy - 21, cx + 26, cy + 30, rgba(0xf5e7b8, 180), 1);
    return;
  }

  if (icon === "left" || icon === "right") {
    const dir = icon === "left" ? 1 : -1;
    fillPolygon(canvas, [
      [cx - dir * 35, cy],
      [cx - dir * 5, cy - 30],
      [cx - dir * 5, cy - 12],
      [cx + dir * 28, cy - 12],
      [cx + dir * 28, cy + 12],
      [cx - dir * 5, cy + 12],
      [cx - dir * 5, cy + 30]
    ], gold);
    strokePolygon(canvas, [
      [cx - dir * 35, cy],
      [cx - dir * 5, cy - 30],
      [cx - dir * 5, cy - 12],
      [cx + dir * 28, cy - 12],
      [cx + dir * 28, cy + 12],
      [cx - dir * 5, cy + 12],
      [cx - dir * 5, cy + 30]
    ], dark, 2);
    for (let offset = -18; offset <= 18; offset += 12) {
      line(canvas, cx - dir * 48, cy + offset, cx - dir * 28, cy + offset - 8, accent, 2);
    }
    return;
  }

  if (icon === "wire") {
    line(canvas, cx - 38, cy - 18, cx + 38, cy - 36, grey, 6);
    line(canvas, cx - 35, cy + 31, cx + 40, cy + 12, grey, 6);
    line(canvas, cx - 15, cy - 44, cx + 15, cy + 46, dark, 5);
    line(canvas, cx - 11, cy - 44, cx + 19, cy + 46, rgba(0xf5e7b8, 180), 1);
    return;
  }

  if (icon === "focus") {
    strokeCircle(canvas, cx, cy, 30, white, 4);
    strokeCircle(canvas, cx, cy, 15, rgba(0xf2d18a, 255), 2);
    line(canvas, cx, cy - 42, cx, cy + 42, white, 3);
    line(canvas, cx - 42, cy, cx + 42, cy, white, 3);
    fillCircle(canvas, cx, cy, 6, gold);
    fillCircle(canvas, cx, cy, 2, dark);
    return;
  }

  if (icon === "shield") {
    fillPolygon(canvas, [[cx, cy - 42], [cx + 34, cy - 25], [cx + 28, cy + 18], [cx, cy + 43], [cx - 28, cy + 18], [cx - 34, cy - 25]], accent);
    strokePolygon(canvas, [[cx, cy - 42], [cx + 34, cy - 25], [cx + 28, cy + 18], [cx, cy + 43], [cx - 28, cy + 18], [cx - 34, cy - 25]], white, 3);
    strokeCircle(canvas, cx, cy - 2, 20, white, 2);
    fillCircle(canvas, cx, cy, 8, rgba(0xf2d18a, 255));
    return;
  }

  if (icon === "heart") {
    fillCircle(canvas, cx - 13, cy - 8, 16, red);
    fillCircle(canvas, cx + 13, cy - 8, 16, red);
    fillPolygon(canvas, [[cx - 29, cy - 1], [cx + 29, cy - 1], [cx, cy + 38]], red);
    strokeCircle(canvas, cx - 13, cy - 8, 17, dark, 2);
    strokeCircle(canvas, cx + 13, cy - 8, 17, dark, 2);
    line(canvas, cx - 25, cy + 3, cx, cy + 38, dark, 2);
    line(canvas, cx + 25, cy + 3, cx, cy + 38, dark, 2);
  }
}

function buildCardFronts() {
  const c = makeCanvas(156 * cardSpecs.length, 198);
  cardSpecs.forEach((spec, index) => drawCardFront(c, index, spec));
  return c;
}

savePng(out.panels, buildPanels());
savePng(out.cardFronts, buildCardFronts());
savePng(out.cardFrames, buildCardFrames());
savePng(out.cardIcons, buildIcons());

console.log(`Wrote ${Object.values(out).join(", ")}`);
