// Pure logic for the Money map: pairwise debts and a radial network layout.

import { computeShares } from './splits.js';

/**
 * Who owes whom, per pair, from every expense (A owes B for B's payments,
 * netted against what B owes A). Sorted by amount, largest first.
 * @returns {{ from: string, to: string, amount: number }[]}
 */
export function pairwiseDebts(trip) {
  const owed = new Map(); // "from|to" -> amount
  for (const e of trip.expenses) {
    const shares = computeShares(e);
    for (const [id, share] of Object.entries(shares)) {
      if (id === e.paidBy || share <= 0) continue;
      const key = `${id}|${e.paidBy}`;
      owed.set(key, (owed.get(key) ?? 0) + share);
    }
  }
  const result = [];
  const seen = new Set();
  for (const [key, amount] of owed) {
    const [a, b] = key.split('|');
    const pair = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(pair)) continue;
    seen.add(pair);
    const net = amount - (owed.get(`${b}|${a}`) ?? 0);
    if (net > 0) result.push({ from: a, to: b, amount: net });
    else if (net < 0) result.push({ from: b, to: a, amount: -net });
  }
  return result.sort((x, y) => y.amount - x.amount);
}

/** Evenly place n points on a circle, starting at the top, clockwise. */
export function circleLayout(n, cx, cy, r) {
  if (n === 1) return [{ x: cx, y: cy, angle: -Math.PI / 2 }];
  return Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), angle };
  });
}

/** Node radius grows with the square root of what someone paid (area ∝ money). */
export function nodeRadius(paid, maxPaid, min = 20, max = 34) {
  if (maxPaid <= 0) return min;
  return min + (max - min) * Math.sqrt(Math.max(0, paid) / maxPaid);
}

const toward = (p, q, dist) => {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: p.x + (dx / len) * dist, y: p.y + (dy / len) * dist };
};

/**
 * Curved arrow from node a to node b that bows sideways (so it never runs
 * through the middle) and stops at the node edges.
 * @returns {{ d: string, label: { x: number, y: number } }}
 */
export function arrowPath(a, b, ra, rb, bend = 0.2) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const c = { x: mx + (-dy / dist) * dist * bend, y: my + (dx / dist) * dist * bend };
  const s = toward(a, c, ra + 3);
  const e = toward(b, c, rb + 6);
  const r = (v) => Math.round(v * 10) / 10;
  return {
    d: `M${r(s.x)},${r(s.y)} Q${r(c.x)},${r(c.y)} ${r(e.x)},${r(e.y)}`,
    label: { x: r(0.25 * s.x + 0.5 * c.x + 0.25 * e.x), y: r(0.25 * s.y + 0.5 * c.y + 0.25 * e.y) },
  };
}
