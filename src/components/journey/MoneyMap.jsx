import { useMemo, useRef, useState } from 'react';
import { useAppState } from '../../hooks/useAppState.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { computeBalances, totalExpenditure } from '../../utils/balances.js';
import { settleUp } from '../../utils/settlement.js';
import { arrowPath, circleLayout, nodeRadius, pairwiseDebts } from '../../utils/moneymap.js';
import { personColor } from '../../utils/journey.js';
import { formatMoney } from '../../utils/money.js';
import { formatDateTime } from '../../utils/dates.js';
import { downloadFile, slugify } from '../../utils/download.js';
import { svgToPng } from '../../utils/svgExport.js';
import { WATERMARK } from '../../utils/export.js';
import Avatar from '../ui/Avatar.jsx';
import { ArrowRightIcon, DownloadIcon } from '../ui/Icons.jsx';

const W = 460;
const H = 420;
const CX = W / 2;
const CY = H / 2;
const RING = 118;
const FONT = "'Inter Variable', ui-sans-serif, system-ui, sans-serif";

function palette(isDark) {
  return isDark
    ? { bg: '#18181b', fg: '#fafafa', muted: '#a1a1aa', line: '#71717a', node: '#18181b', pos: '#34d399', neg: '#f87171', even: '#52525b', pill: '#27272a' }
    : { bg: '#ffffff', fg: '#18181b', muted: '#71717a', line: '#a1a1aa', node: '#ffffff', pos: '#059669', neg: '#dc2626', even: '#d4d4d8', pill: '#f4f4f5' };
}

const short = (s, n = 11) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export default function MoneyMap({ trip, isDark }) {
  const { currency } = useAppState();
  const toast = useToast();
  const money = (v) => formatMoney(v, currency);
  const svgRef = useRef(null);
  const [mode, setMode] = useState('settle'); // 'settle' | 'owes'
  const [selected, setSelected] = useState(null);
  const pal = palette(isDark);

  const data = useMemo(() => {
    const balances = computeBalances(trip.participants, trip.expenses);
    const byId = Object.fromEntries(balances.map((b) => [b.id, b]));
    const maxPaid = Math.max(0, ...balances.map((b) => b.paid));
    const pts = circleLayout(trip.participants.length, CX, CY, RING);
    const nodes = trip.participants.map((p, i) => ({
      ...byId[p.id],
      photo: p.photo ?? null,
      ...pts[i],
      r: nodeRadius(byId[p.id].paid, maxPaid),
      color: personColor(trip, p.id),
    }));
    return {
      nodes,
      byId: Object.fromEntries(nodes.map((n) => [n.id, n])),
      settle: settleUp(balances),
      owes: pairwiseDebts(trip),
      total: totalExpenditure(trip.expenses),
    };
  }, [trip]);

  const arrows = mode === 'settle' ? data.settle : data.owes;
  const maxArrow = Math.max(1, ...arrows.map((a) => a.amount));
  const sel = selected && data.byId[selected] ? selected : null;
  const involved = (a) => !sel || a.from === sel || a.to === sel;
  const showLabels = arrows.length <= 6 || !!sel;
  const nameOf = (id) => data.byId[id]?.name ?? 'Unknown';

  const statusColor = (net) => (net > 0 ? pal.pos : net < 0 ? pal.neg : pal.even);
  const arrowColor = (a) => (!sel ? pal.line : a.from === sel ? pal.neg : a.to === sel ? pal.pos : pal.line);
  const markerFor = (a) => (!sel ? 'mm-arrow' : a.from === sel ? 'mm-arrow-neg' : a.to === sel ? 'mm-arrow-pos' : 'mm-arrow');

  const toggle = (id) => setSelected((cur) => (cur === id ? null : id));

  const saveImage = async () => {
    try {
      const blob = await svgToPng(svgRef.current, pal.bg, 2, { text: WATERMARK, color: pal.muted });
      const name = `${slugify(trip.name)}-money-map.png`;
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `${trip.name} – money map` });
      else {
        downloadFile(name, blob, 'image/png');
        toast('Image saved');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') toast('Could not create the image', 'error');
    }
  };

  // Details for the panel below the map.
  const person = sel ? data.byId[sel] : null;
  const pays = sel ? arrows.filter((a) => a.from === sel) : [];
  const receives = sel ? arrows.filter((a) => a.to === sel) : [];
  const paidFor = sel
    ? [...trip.expenses].filter((e) => e.paidBy === sel).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
    : [];

  const activity = [...trip.expenses].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

  /** Each expense: who paid, what for, category, date + time (hh:mm), amount. */
  const ActivityList = ({ items }) => (
    <ul className="divide-y divide-zinc-100 pb-1 dark:divide-zinc-800">
      {items.map((e) => (
        <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
          <Avatar trip={trip} id={e.paidBy} name={nameOf(e.paidBy)} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-medium">{e.description}</span>
              {e.category && (
                <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {e.category}
                </span>
              )}
            </span>
            <span className="block truncate text-[13px] text-zinc-500 dark:text-zinc-400">
              {nameOf(e.paidBy)} paid · <time dateTime={e.dateTime}>{formatDateTime(e.dateTime)}</time>
            </span>
          </span>
          <span className="num shrink-0 text-[15px] font-semibold">{money(e.amount)}</span>
        </li>
      ))}
    </ul>
  );

  const TransferList = ({ items, emptyText }) =>
    items.length === 0 ? (
      <p className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">{emptyText}</p>
    ) : (
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {items.map((a, i) => (
          <li key={i} className="list-row min-h-12">
            <span className="flex items-center">
              <Avatar trip={trip} id={a.from} name={nameOf(a.from)} size="sm" ring />
              <ArrowRightIcon className="mx-1 size-3.5 text-zinc-400" />
              <Avatar trip={trip} id={a.to} name={nameOf(a.to)} size="sm" ring />
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px]">
              <span className="font-medium">{nameOf(a.from)}</span>
              <span className="text-zinc-500 dark:text-zinc-400"> {mode === 'settle' ? 'pays' : 'owes'} </span>
              <span className="font-medium">{nameOf(a.to)}</span>
            </span>
            <span className="num text-[15px] font-semibold">{money(a.amount)}</span>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 p-2 pl-4 dark:border-zinc-800">
          <div>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Total spent</p>
            <p className="num text-[17px] leading-tight font-semibold">{money(data.total)}</p>
          </div>
          <div className="flex items-center gap-1">
            <div role="radiogroup" aria-label="What the arrows show" className="segmented">
              <button type="button" role="radio" aria-checked={mode === 'settle'} onClick={() => setMode('settle')}>
                Settle up
              </button>
              <button type="button" role="radio" aria-checked={mode === 'owes'} onClick={() => setMode('owes')}>
                All debts
              </button>
            </div>
            <button type="button" className="icon-btn" onClick={saveImage} aria-label="Save map as image">
              <DownloadIcon className="size-[18px]" />
            </button>
          </div>
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          data-width={W}
          data-height={H}
          className="mx-auto block w-full max-w-[480px] select-none"
          fontFamily={FONT}
          role="group"
          aria-label={`Money map. ${arrows.length} ${mode === 'settle' ? 'payments to settle up' : 'debts between people'}.`}
          onClick={(e) => e.target === svgRef.current && setSelected(null)}
        >
          <defs>
            {[
              ['mm-arrow', pal.line],
              ['mm-arrow-neg', pal.neg],
              ['mm-arrow-pos', pal.pos],
            ].map(([id, fill]) => (
              <marker key={id} id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill={fill} />
              </marker>
            ))}
          </defs>

          {/* orbit */}
          {data.nodes.length > 1 && (
            <circle cx={CX} cy={CY} r={RING} fill="none" stroke={pal.even} strokeOpacity={0.6} strokeDasharray="2 5" />
          )}

          {/* arrows */}
          <g fill="none" strokeLinecap="round">
            {arrows.map((a, i) => {
              const A = data.byId[a.from];
              const B = data.byId[a.to];
              if (!A || !B) return null;
              const { d } = arrowPath(A, B, A.r, B.r, 0.22);
              const on = involved(a);
              return (
                <path
                  key={`${a.from}-${a.to}-${i}`}
                  d={d}
                  stroke={arrowColor(a)}
                  strokeWidth={1.25 + (a.amount / maxArrow) * 3.5}
                  strokeOpacity={on ? 0.95 : 0.12}
                  markerEnd={`url(#${markerFor(a)})`}
                  className={sel && on ? 'flow' : undefined}
                />
              );
            })}
          </g>

          {/* amount pills */}
          {showLabels && (
            <g pointerEvents="none">
              {arrows.map((a, i) => {
                const A = data.byId[a.from];
                const B = data.byId[a.to];
                if (!A || !B || !involved(a)) return null;
                const { label } = arrowPath(A, B, A.r, B.r, 0.22);
                const text = money(a.amount);
                const w = text.length * 6.4 + 12;
                return (
                  <g key={`l-${i}`} transform={`translate(${label.x},${label.y})`}>
                    <rect x={-w / 2} y={-10} width={w} height={20} rx={10} fill={pal.pill} stroke={pal.even} strokeWidth="0.75" />
                    <text textAnchor="middle" y={4} fontSize="11" fontWeight="600" fill={pal.fg}>
                      {text}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* people */}
          {data.nodes.map((n) => {
            const dim = sel && sel !== n.id && !arrows.some((a) => (a.from === sel && a.to === n.id) || (a.to === sel && a.from === n.id));
            const isSel = sel === n.id;
            const label = n.net > 0 ? `+${money(n.net)}` : n.net < 0 ? money(n.net) : 'settled';
            // Put the name outside the ring (away from the arrows inside it).
            const single = data.nodes.length === 1;
            const cos = single ? 0 : Math.cos(n.angle);
            const sin = single ? 1 : Math.sin(n.angle);
            const gap = n.r + 10;
            const lx = cos * gap;
            const ly = sin * gap;
            const anchor = cos > 0.35 ? 'start' : cos < -0.35 ? 'end' : 'middle';
            // Two text lines: shift the block so it sits above (top nodes) or below (bottom nodes).
            const top = sin < -0.35 ? ly - 18 : sin > 0.35 ? ly + 12 : ly - 3;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                opacity={dim ? 0.3 : 1}
                role="button"
                tabIndex={0}
                aria-pressed={isSel}
                aria-label={`${n.name}: paid ${money(n.paid)}, ${n.net > 0 ? `gets back ${money(n.net)}` : n.net < 0 ? `owes ${money(-n.net)}` : 'settled'}`}
                onClick={() => toggle(n.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle(n.id))}
                className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-[5]"
                style={{ transition: 'opacity 200ms' }}
              >
                {isSel && <circle r={n.r + 7} fill="none" stroke={statusColor(n.net)} strokeOpacity={0.3} strokeWidth={5} />}
                <circle r={n.r} fill={pal.node} stroke={statusColor(n.net)} strokeWidth={2.5} />
                {n.photo ? (
                  <>
                    <clipPath id={`mm-clip-${n.id}`}>
                      <circle r={n.r - 3} />
                    </clipPath>
                    <image href={n.photo} x={-(n.r - 3)} y={-(n.r - 3)} width={(n.r - 3) * 2} height={(n.r - 3) * 2} clipPath={`url(#mm-clip-${n.id})`} preserveAspectRatio="xMidYMid slice" />
                  </>
                ) : (
                  <>
                    <circle r={n.r - 4} fill={n.color} fillOpacity={isDark ? 0.22 : 0.12} />
                    <text textAnchor="middle" y={n.r > 26 ? 6 : 5} fontSize={n.r > 26 ? 16 : 13} fontWeight="600" fill={n.color}>
                      {n.name.trim().charAt(0).toUpperCase()}
                    </text>
                  </>
                )}
                <text x={lx} y={top} textAnchor={anchor} fontSize="12.5" fontWeight="600" fill={pal.fg}>
                  {short(n.name, 10)}
                </text>
                <text x={lx} y={top + 14} textAnchor={anchor} fontSize="11" fontWeight="500" fill={n.net === 0 ? pal.muted : statusColor(n.net)}>
                  {label}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-100 px-4 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-2 border-emerald-600 dark:border-emerald-400" /> gets back
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-2 border-red-600 dark:border-red-400" /> owes
          </span>
          <span>Bigger circle = paid more</span>
          <span>Thicker arrow = larger amount</span>
        </div>
      </div>

      {/* Details */}
      {person ? (
        <section className="card overflow-hidden" aria-live="polite">
          <div className="flex items-center gap-3 p-4">
            <Avatar trip={trip} id={person.id} name={person.name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold tracking-tight">{person.name}</p>
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                {person.net > 0 ? (
                  <>
                    Gets back <span className="pos num font-medium">{money(person.net)}</span>
                  </>
                ) : person.net < 0 ? (
                  <>
                    Owes <span className="neg num font-medium">{money(-person.net)}</span> in total
                  </>
                ) : (
                  'All settled'
                )}
              </p>
            </div>
            <button type="button" className="btn-ghost h-9 px-3 text-[13px]" onClick={() => setSelected(null)}>
              Clear
            </button>
          </div>
          <div className="grid grid-cols-2 divide-x divide-zinc-100 border-y border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
            <div className="px-4 py-3">
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Paid</p>
              <p className="num text-[17px] font-semibold">{money(person.paid)}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Their share</p>
              <p className="num text-[17px] font-semibold">{money(person.share)}</p>
            </div>
          </div>

          <p className="eyebrow px-4 pt-4 pb-1">{mode === 'settle' ? 'Pays' : 'Owes'}</p>
          <TransferList items={pays} emptyText={`${person.name} doesn’t need to pay anyone.`} />
          <p className="eyebrow px-4 pt-4 pb-1">{mode === 'settle' ? 'Receives' : 'Is owed by'}</p>
          <TransferList items={receives} emptyText={`Nobody needs to pay ${person.name}.`} />

          <p className="eyebrow px-4 pt-4 pb-1">Paid for</p>
          {paidFor.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-zinc-500 dark:text-zinc-400">{person.name} hasn’t paid for anything yet.</p>
          ) : (
            <ActivityList items={paidFor} />
          )}
        </section>
      ) : (
        <>
          <section className="card overflow-hidden">
            <div className="flex items-baseline justify-between px-4 pt-4 pb-1">
              <h3 className="text-[15px] font-semibold tracking-tight">{mode === 'settle' ? 'Payments to settle up' : 'All debts'}</h3>
              <span className="text-[13px] text-zinc-500">Tap a person</span>
            </div>
            <TransferList items={arrows} emptyText="Everyone is settled up." />
          </section>

          <section className="card overflow-hidden" aria-labelledby="mm-activity">
            <div className="flex items-baseline justify-between px-4 pt-4 pb-1">
              <h3 id="mm-activity" className="text-[15px] font-semibold tracking-tight">
                Spending activity
              </h3>
              <span className="text-[13px] text-zinc-500">{trip.expenses.length} in order</span>
            </div>
            <ActivityList items={activity} />
          </section>
        </>
      )}
    </div>
  );
}
