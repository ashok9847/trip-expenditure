// Pure layout for the trail map (SVG user units, 390 wide). Every stop gets
// its own seeded jitter, tilt and size, so no two stops look the same, but the
// same trip always lays out identically.

import { hashSeed, wrapText } from './copy.js';

export const MAP_W = 390;
const GAP = 58; // vertical space between stops (the trail crosses here)
const DAY_PAD = 42; // extra space where a new day starts
const EDGE = 20;

/** mulberry32 PRNG */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bigger spend, bigger sticker (area-ish scaling). */
export const stickerSize = (amount, max) => Math.round(50 + 34 * Math.sqrt(Math.max(0, amount) / Math.max(1, max)));

/**
 * Fit a single-line label into `width` user units, assuming ~charW per char.
 * Returns the full text if it fits, otherwise the longest code-point prefix
 * (trailing spaces trimmed) that fits together with an ellipsis.
 */
export function fitLabel(text, width, charW = 7.2) {
  const chars = [...String(text ?? '')];
  if (chars.length * charW <= width) return chars.join('');
  const n = Math.max(0, Math.floor(width / charW) - 1);
  return `${chars.slice(0, n).join('').trimEnd()}…`;
}

/** Smooth path through points (Catmull-Rom converted to cubic Béziers). */
export function smoothPath(pts) {
  if (pts.length < 2) return '';
  const r = (v) => Math.round(v * 10) / 10;
  let d = `M${r(pts[0].x)},${r(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${r(c1.x)},${r(c1.y)} ${r(c2.x)},${r(c2.y)} ${r(p2.x)},${r(p2.y)}`;
  }
  return d;
}

/**
 * @param {Array<{ id:string, amount:number, day:number, newDay:boolean, title:string,
 *   caption:string, debtCount:number, owesLabel:string }>} stops
 */
export function layoutTrail(stops, { width: W = MAP_W, seed = '' } = {}) {
  const max = Math.max(1, ...stops.map((s) => s.amount));
  const start = { x: 76, y: 70 };
  let cursor = start.y + 34; // bottom of the flag
  const laid = [];
  const segments = [];
  const scenery = [];
  const gaps = [];
  let prevDrop = { x: start.x, y: start.y + 30 };

  stops.forEach((s, i) => {
    const r = rng(hashSeed(`${seed}:${s.id}`));
    const size = stickerSize(s.amount, max);
    const side = i % 2 === 0 ? 1 : -1; // +1 sticker on the right, text on the left
    const jitter = r() * 26;
    const x = side > 0 ? W - EDGE - size / 2 - jitter : EDGE + size / 2 + jitter;
    const textX = side > 0 ? x - size / 2 - 12 : x + size / 2 + 12;
    const textW = side > 0 ? textX - 26 : W - 26 - textX;

    // Text block: title, amount, "X paid", caption (1-2 lines), who owes.
    const titleText = wrapText(s.title, Math.max(6, Math.floor(textW / 10.5)), 1)[0] ?? '';
    const captionLines = wrapText(s.caption, Math.max(8, Math.floor(textW / 7)), 2);
    const avatarsW = 18 + Math.max(0, Math.min(s.debtCount, 6) - 1) * 13;
    const labelW = s.owesLabel.length * 6.1;
    const owesTwoLines = s.debtCount > 0 && avatarsW + 8 + labelW > textW;
    const blockH = 24 + 32 + 20 + captionLines.length * 17 + (s.debtCount > 0 ? (owesTwoLines ? 40 : 26) : 4);
    const hh = Math.max(size / 2 + 8, blockH / 2 + 4);

    const top = cursor + GAP + (s.newDay ? DAY_PAD : 0);
    const cy = Math.round(top + hh);
    const blockTop = cy - blockH / 2;
    const drop = { x: Math.round(x), y: Math.round(cy + size / 2 + 14) };
    const ym = Math.round(cursor + (top - cursor) * (s.newDay ? 0.35 : 0.5));
    gaps.push({ y: ym, from: prevDrop.x, to: drop.x });

    // Trail leg: down from the previous drop point, across the gap, down into this stop.
    segments.push(`C${prevDrop.x},${ym} ${drop.x},${ym} ${drop.x},${drop.y}`);

    const avatarsY = blockTop + 24 + 32 + 20 + captionLines.length * 17 + 12;
    const mini = Array.from({ length: Math.min(s.debtCount, 6) }, (_, k) => ({
      x: side > 0 ? textX - 9 - k * 13 : textX + 9 + k * 13,
      y: avatarsY,
    }));

    laid.push({
      id: s.id,
      index: i,
      side,
      x: Math.round(x),
      cy,
      size,
      hh,
      top,
      bottom: cy + hh,
      tilt: Math.round((r() * 6 - 3) * 10) / 10,
      holder: r() < 0.55 ? 'tape' : 'pin',
      tapeAngle: Math.round(r() * 30 - 15),
      textX: Math.round(textX),
      textW,
      anchor: side > 0 ? 'end' : 'start',
      titleText,
      titleY: blockTop + 20,
      amountY: blockTop + 24 + 28,
      paidY: blockTop + 24 + 32 + 16,
      captionLines,
      captionY: blockTop + 24 + 32 + 20 + 13,
      mini,
      owesTwoLines,
      owesY: owesTwoLines ? avatarsY + 19 : avatarsY + 4,
      owesX: owesTwoLines ? textX : side > 0 ? textX - avatarsW - 6 : textX + avatarsW + 6,
      payer: {
        x: Math.round(x + side * size * 0.36),
        y: Math.round(cy - size * 0.36),
        r: Math.round(16 + size * 0.05),
        tilt: side * (6 + r() * 6),
      },
      decor: { x: Math.round(x - side * size * 0.42), y: Math.round(cy + size * 0.4) },
      drop,
      riverX: side > 0 ? 4 : W - 4,
      day: s.day,
    });

    cursor = cy + hh;
    prevDrop = drop;
  });

  // Camp (settle up) at the bottom.
  const campTop = cursor + GAP + 24;
  const camp = { x: W / 2, y: campTop + 56 };
  const end = { x: W / 2 + 4, y: camp.y + 42 };
  const ymEnd = Math.round(cursor + (campTop - cursor) / 2);
  segments.push(`C${prevDrop.x},${ymEnd} ${end.x},${ymEnd} ${end.x},${end.y}`);
  gaps.push({ y: ymEnd, from: prevDrop.x, to: end.x });
  const height = Math.round(camp.y + 120);

  // River: snakes to the edge beside every stop, crossing the middle in the gaps.
  const riverPts = [{ x: W * 0.72, y: -30 }, ...laid.map((l) => ({ x: l.riverX, y: l.cy })), { x: W * 0.16, y: camp.y - 20 }, { x: W * 0.46, y: height + 30 }];

  // Day regions.
  const days = [];
  for (const l of laid) {
    const last = days[days.length - 1];
    if (!last || last.day !== l.day) days.push({ day: l.day, y0: l.top - DAY_PAD + 8, y1: l.bottom + 18, labelLeft: l.side > 0 });
    else last.y1 = l.bottom + 18;
  }

  // Scenery in the gaps: bushes just above the trail line, trees just below.
  const sr = rng(hashSeed(`${seed}:scenery`));
  gaps.forEach((g, gi) => {
    const avoid = (x) => Math.abs(x - W / 2) < 46;
    for (let k = 0; k < 3; k++) {
      let x = 18 + sr() * (W - 36);
      if (avoid(x)) x += x < W / 2 ? -50 : 50;
      const tree = k !== 1;
      scenery.push({ type: tree ? (sr() < 0.5 ? 'pine' : 'pine2') : 'bush', x: Math.round(x), y: Math.round(g.y + (tree ? 27 : -7)), s: Math.round((0.55 + sr() * 0.3) * 100) / 100, delay: Math.round(sr() * 2000) });
    }
    if (gi > 0 && gi < gaps.length - 1) scenery.push({ type: gi % 2 ? 'bridge' : 'stones', x: Math.round(W / 2), y: g.y, s: 1, delay: 0 });
  });
  for (const d of days) {
    const mx = d.labelLeft ? W - 78 : 78;
    scenery.push({ type: 'mountains', x: mx, y: d.y0 + 34, s: 0.8, delay: 0 });
    scenery.push({ type: 'cloud', x: mx + (d.labelLeft ? -40 : 30), y: d.y0 + 4, s: 0.7, delay: Math.round(sr() * 4000) });
  }
  scenery.push({ type: 'cloud', x: W - 120, y: 42, s: 1, delay: 0 });
  scenery.push({ type: 'mountains', x: W - 92, y: 128, s: 1, delay: 0 });
  scenery.push({ type: 'pine', x: camp.x - 108, y: camp.y + 40, s: 0.9, delay: 300 });
  scenery.push({ type: 'pine2', x: camp.x + 112, y: camp.y + 36, s: 1, delay: 900 });
  scenery.push({ type: 'bush', x: camp.x + 84, y: camp.y + 54, s: 0.8, delay: 0 });

  return {
    width: W,
    height,
    start,
    camp,
    end,
    stops: laid,
    days,
    scenery,
    river: smoothPath(riverPts),
    trailStart: `M${start.x},${start.y + 30}`,
    segments,
  };
}
