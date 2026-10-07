import { describe, it, expect } from 'vitest';
import { pairwiseDebts, circleLayout, nodeRadius, arrowPath } from '../utils/moneymap.js';
import { computeBalances } from '../utils/balances.js';

const E = (id, amount, paidBy, participantIds, extra = {}) => ({
  id, description: id, amount, paidBy, participantIds, splitMode: 'equal', dateTime: '2026-09-29T10:00:00Z', ...extra,
});
const participants = [
  { id: 'r', name: 'Ravi' },
  { id: 'k', name: 'Kiran' },
  { id: 'a', name: 'Anil' },
];

describe('pairwiseDebts', () => {
  it('nets debts between each pair', () => {
    const trip = {
      participants,
      expenses: [
        E('1', 900, 'r', ['r', 'k', 'a']), // k owes r 300, a owes r 300
        E('2', 400, 'k', ['k', 'r']), // r owes k 200
      ],
    };
    expect(pairwiseDebts(trip)).toEqual([
      { from: 'a', to: 'r', amount: 300 },
      { from: 'k', to: 'r', amount: 100 },
    ]);
  });

  it('drops pairs that cancel out and ignores zero custom shares', () => {
    const trip = {
      participants,
      expenses: [
        E('1', 200, 'r', ['r', 'k']),
        E('2', 200, 'k', ['k', 'r']),
        E('3', 500, 'a', ['a', 'k'], { splitMode: 'custom', customShares: { a: 500, k: 0 } }),
      ],
    };
    expect(pairwiseDebts(trip)).toEqual([]);
  });

  it('is consistent with net balances', () => {
    const trip = {
      participants,
      expenses: [E('1', 1000, 'r', ['r', 'k', 'a']), E('2', 777, 'a', ['k']), E('3', 50, 'k', ['r', 'a'])],
    };
    const nets = Object.fromEntries(participants.map((p) => [p.id, 0]));
    for (const d of pairwiseDebts(trip)) {
      nets[d.from] -= d.amount;
      nets[d.to] += d.amount;
    }
    for (const b of computeBalances(participants, trip.expenses)) expect(nets[b.id]).toBe(b.net);
  });
});

describe('layout helpers', () => {
  it('places the first node at the top and spaces nodes evenly', () => {
    const pts = circleLayout(4, 100, 100, 50);
    expect(pts[0].x).toBeCloseTo(100);
    expect(pts[0].y).toBeCloseTo(50);
    expect(pts[1].x).toBeCloseTo(150);
    expect(pts[2].y).toBeCloseTo(150);
    expect(circleLayout(1, 10, 20, 50)).toEqual([{ x: 10, y: 20, angle: -Math.PI / 2 }]);
  });

  it('scales node radius by area', () => {
    expect(nodeRadius(0, 100)).toBe(20);
    expect(nodeRadius(100, 100)).toBe(34);
    expect(nodeRadius(25, 100)).toBe(27);
    expect(nodeRadius(5, 0)).toBe(20);
  });

  it('builds a curved arrow that stops short of both nodes', () => {
    const { d, label } = arrowPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 10, 10);
    expect(d.startsWith('M')).toBe(true);
    expect(d).toContain('Q50,20');
    const [sx] = d.slice(1).split(',').map(Number);
    expect(sx).toBeGreaterThan(0);
    expect(label.y).toBeGreaterThan(0); // bows to one side
  });
});
