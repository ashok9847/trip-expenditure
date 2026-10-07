// The trail map as one pure SVG in a flat travel-poster style: a dark road
// with a dashed centre lane, clean marker discs, two-line labels and a few
// muted decor shapes. Shared by the live map (with the car as a child) and
// the story export (live = false).
import { memo } from 'react';
import { ACCENT, GROT, SANS, SCENE_RING } from './palette.js';
import { Sticker } from './Stickers.jsx';
import { fitLabel, rng, smoothPath } from '../../utils/trailLayout.js';
import { hashSeed } from '../../utils/copy.js';
import { personColor } from '../../utils/journey.js';
import { totalExpenditure } from '../../utils/balances.js';
import { initials } from '../ui/Avatar.jsx';

const PAID_BY = 'paid by ';
const LABEL_CHAR_W = 6.4; // ~Inter 11.5px lower case

/** Flat car marker, ~22×12, centred on (0, 0) and facing right. */
export function Car() {
  return (
    <g>
      <rect x="-11" y="-6" width="22" height="10" rx="3.5" fill={ACCENT} />
      <path d="M-4 -6 L-2 -10 H5 L8 -6 Z" fill={ACCENT} />
      <path d="M-1.8 -6.4 L-0.8 -8.6 H4.4 L6 -6.4 Z" fill="#FFFDF8" opacity=".9" />
      <circle cx="-6" cy="4.5" r="2.6" fill="#1D1D2B" />
      <circle cx="6" cy="4.5" r="2.6" fill="#1D1D2B" />
    </g>
  );
}

/**
 * The traveller that moves along the road: the payer's photo (or initials)
 * in a round badge with a light border, a soft shadow and a small pointer
 * resting on the road point (0, 0).
 */
export function Mover({ trip, person, pal, idp = 'mv' }) {
  const r = 15;
  const cy = -r - 9; // badge floats above the road; the pointer touches (0, 0)
  const clip = `${idp}-mover-${person?.id ?? 'x'}`;
  return (
    <g>
      <ellipse cx="0" cy="1.5" rx="7" ry="2.5" fill="#000" opacity=".22" />
      <path d={`M-6 ${cy + r - 3} L0 -1 L6 ${cy + r - 3} Z`} fill={pal.disc} />
      <circle cy={cy} r={r + 3} fill={pal.disc} />
      <circle cy={cy} r={r + 3} fill="none" stroke={ACCENT} strokeWidth="2" />
      {person?.photo ? (
        <>
          <clipPath id={clip}>
            <circle cy={cy} r={r} />
          </clipPath>
          <image href={person.photo} x={-r} y={cy - r} width={r * 2} height={r * 2} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
        </>
      ) : (
        <>
          <circle cy={cy} r={r} fill={personColor(trip, person?.id)} />
          <text y={cy + 4.5} textAnchor="middle" fontFamily={SANS} fontWeight="700" fontSize="12.5" fill="#FFFDF8">
            {initials(person?.name ?? '?')}
          </text>
        </>
      )}
    </g>
  );
}

/** Road strokes (edge, asphalt, lane) for one path. */
function Road({ d, pal, trailRef }) {
  const common = { d, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <>
      <path {...common} stroke={pal.edge} strokeWidth="17" />
      <path {...common} ref={trailRef} stroke={pal.road} strokeWidth="13" />
      <path {...common} stroke={pal.lane} strokeWidth="1.5" strokeDasharray="7 7" />
    </>
  );
}

/** 5–7 seeded, closed, smooth contour loops. */
function contours(seed, W, H) {
  const r = rng(hashSeed(`${seed}:topo`));
  const n = 5 + Math.floor(r() * 3);
  return Array.from({ length: n }, () => {
    const cx = r() * W;
    const cy = r() * H;
    const base = 40 + r() * 100;
    const k = 8;
    const pts = Array.from({ length: k }, (_, j) => {
      const a = (j / k) * Math.PI * 2;
      const rad = base * (0.75 + r() * 0.5);
      return { x: cx + Math.cos(a) * rad * 1.3, y: cy + Math.sin(a) * rad };
    });
    return `${smoothPath([...pts, pts[0], pts[1]])} Z`;
  });
}

function Pine({ pal }) {
  return (
    <g>
      <rect x="-1.5" y="-6" width="3" height="6" fill={pal.tree} />
      <path d="M0 -40 L-11 -22 H-5 L-13 -6 H13 L5 -22 H11Z" fill={pal.tree} />
    </g>
  );
}
function Pine2({ pal }) {
  return (
    <g>
      <rect x="-1.5" y="-6" width="3" height="6" fill={pal.tree} />
      <path d="M0 -34 L-10 -6 H10Z" fill={pal.tree} />
    </g>
  );
}
function Hills({ pal }) {
  return <path d="M-42 0 L-18 -30 L-4 -13 L8 -26 L38 0Z" fill={pal.hill} />;
}
const SCENERY = { pine: Pine, pine2: Pine2, mountains: Hills };

function Avatar({ trip, person, x, y, pal, clip }) {
  const r = 10;
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r + 2} fill={pal.disc} />
      {person.photo ? (
        <>
          <clipPath id={clip}>
            <circle r={r} />
          </clipPath>
          <image href={person.photo} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
        </>
      ) : (
        <>
          <circle r={r} fill={personColor(trip, person.id)} />
          <text y="3.4" textAnchor="middle" fontFamily={SANS} fontWeight="700" fontSize="9" fill="#FFFDF8">
            {initials(person.name)}
          </text>
        </>
      )}
    </g>
  );
}

function CheckerFlag({ pal }) {
  const sq = 6;
  return (
    <g>
      <rect x="-1" y="-42" width="2" height="42" fill={pal.text} />
      {Array.from({ length: 12 }, (_, k) => {
        const c = k % 4;
        const row = Math.floor(k / 4);
        return <rect key={k} x={1 + c * sq} y={-42 + row * sq} width={sq} height={sq} fill={(c + row) % 2 ? pal.disc : pal.text} />;
      })}
      <rect x="1" y="-42" width={4 * sq} height={3 * sq} fill="none" stroke={pal.text} strokeWidth=".8" />
    </g>
  );
}

function MapScene({ layout, trip, stops, view = [], pal, reached, landed, idp, live, refs = {}, money, nameOf, reduced, showBase, children }) {
  const { width: W, height: H } = layout;
  const d = `${layout.trailStart} ${layout.segments.join(' ')}`;
  const byId = new Map(trip.participants.map((p) => [p.id, p]));
  const topo = contours(trip.id, W, H);
  const n = trip.participants.length;
  const roadStart = { x: layout.start.x, y: layout.start.y + 30 };

  return (
    <>
      {live && (
        <defs>
          <mask id={`${idp}-reveal`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
            <path ref={refs.mask} d={d} fill="none" stroke="#fff" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
          </mask>
        </defs>
      )}

      {/* Decor */}
      <rect width={W} height={H} fill={pal.paper} />
      {layout.days.map((b, k) => (
        <rect key={b.day} x="0" y={b.y0} width={W} height={Math.max(0, b.y1 - b.y0)} fill={pal.band[k % 2]} />
      ))}
      <g fill="none" stroke={pal.text} strokeOpacity=".06" strokeWidth="1">
        {topo.map((p, k) => (
          <path key={k} d={p} />
        ))}
      </g>
      {layout.days.length > 1 &&
        layout.days.map((b) => (
          <text
            key={b.day}
            x={b.labelLeft ? 16 : W - 16}
            y={b.y0 + 20}
            textAnchor={b.labelLeft ? 'start' : 'end'}
            fontFamily={SANS}
            fontSize="10"
            fontWeight="600"
            letterSpacing="2"
            fill={pal.sub}
          >
            {`DAY ${b.day}`}
          </text>
        ))}
      {layout.scenery.map((s, k) => {
        const C = SCENERY[s.type];
        if (!C) return null;
        return (
          <g key={k} transform={`translate(${s.x} ${s.y}) scale(${s.s})`}>
            <C pal={pal} />
          </g>
        );
      })}
      <g transform={`translate(${W - 34} 34)`} aria-hidden="true">
        <circle r="13" fill="none" stroke={pal.sub} strokeWidth="1" />
        <path d="M0 -9 L3.5 3 L0 1 L-3.5 3 Z" fill={pal.sub} />
        <text y="-17" textAnchor="middle" fontFamily={SANS} fontSize="9" fontWeight="600" fill={pal.sub}>
          N
        </text>
      </g>

      {/* Road */}
      {showBase && (
        <g opacity="0.35">
          <Road d={d} pal={pal} />
        </g>
      )}
      <g mask={live ? `url(#${idp}-reveal)` : undefined}>
        <Road d={d} pal={pal} trailRef={refs.trail} />
      </g>
      {live && <path ref={refs.measure} d="" fill="none" stroke="none" />}

      {/* START */}
      <g aria-hidden="true">
        <circle cx={roadStart.x} cy={roadStart.y} r="7" fill={pal.road} stroke={pal.edge} strokeWidth="3" />
        <text x={roadStart.x + 16} y={roadStart.y - 4} fontFamily={SANS} fontSize="10.5" fontWeight="700" letterSpacing="1.4" fill={pal.text}>
          START
        </text>
        <text x={roadStart.x + 16} y={roadStart.y + 10} fontFamily={SANS} fontSize="10" fill={pal.sub}>
          {`${n} ${n === 1 ? 'traveller' : 'travellers'}`}
        </text>
      </g>

      {/* Stops */}
      {layout.stops.map((L, i) => {
        const s = stops[i];
        const sticker = view[i]?.sticker ?? { kind: 'pin', emoji: null, scene: 'misc' };
        const payer = byId.get(s.payerId) ?? { id: s.payerId, name: nameOf?.(s.payerId) ?? '?' };
        const here = !reduced && landed?.i === i;
        const off = 0.36 * L.size;
        const nameW = Math.max(0, L.textW - PAID_BY.length * LABEL_CHAR_W);
        const marker = (
          <>
            <g transform={`translate(${L.x} ${L.cy})`}>
              <Sticker kind={sticker.kind} emoji={sticker.emoji} scene={sticker.scene} size={L.size} disc={pal.disc} />
            </g>
            <Avatar trip={trip} person={payer} x={L.x + off} y={L.cy + off} pal={pal} clip={`${idp}-av-${i}`} />
          </>
        );
        return (
          <g key={s.id} opacity={i < reached ? 1 : 0.18}>
            <path d={`M${L.x} ${L.cy + L.size / 2} L${L.drop.x} ${L.drop.y}`} stroke={pal.sub} strokeWidth="1.2" strokeDasharray="1.5 3" strokeLinecap="round" fill="none" />
            <circle cx={L.drop.x} cy={L.drop.y} r="3" fill={pal.road} stroke={pal.edge} strokeWidth="1.5" />
            {here ? (
              <>
                <circle key={`p${landed.key}`} className="stop-pulse" cx={L.x} cy={L.cy} r={L.size / 2} fill="none" stroke={SCENE_RING[sticker.scene] ?? SCENE_RING.misc} strokeWidth="2" />
                <g className="stop-pop" key={landed.key}>
                  {marker}
                </g>
              </>
            ) : (
              marker
            )}
            <text aria-hidden="true" x={L.textX} y={L.cy - 6} textAnchor={L.anchor} fontFamily={GROT} fontSize="21" fontWeight="700" fill={pal.text} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {money(s.amount)}
            </text>
            {/* what the money was spent on */}
            <text aria-hidden="true" x={L.textX} y={L.cy + 12} textAnchor={L.anchor} fontFamily={SANS} fontSize="12.5" fontWeight="600" fill={pal.text}>
              {fitLabel(s.description, L.textW, 6.9)}
            </text>
            <text aria-hidden="true" x={L.textX} y={L.cy + 28} textAnchor={L.anchor} fontFamily={SANS} fontSize="11.5" fontWeight="500" fill={pal.sub}>
              {PAID_BY + fitLabel(String(payer.name ?? '?').toLowerCase(), nameW, LABEL_CHAR_W)}
            </text>
          </g>
        );
      })}

      {/* FINISH */}
      <g aria-hidden="true">
        <circle cx={layout.end.x} cy={layout.end.y} r="5" fill={pal.road} stroke={pal.edge} strokeWidth="2.5" />
        <g transform={`translate(${layout.end.x + 14} ${layout.end.y})`}>
          <CheckerFlag pal={pal} />
        </g>
        <text x={layout.end.x} y={layout.end.y + 26} textAnchor="middle" fontFamily={SANS} fontSize="10.5" fontWeight="700" letterSpacing="1.4" fill={pal.text}>
          FINISH
        </text>
        <text x={layout.end.x} y={layout.end.y + 50} textAnchor="middle" fontFamily={GROT} fontSize="20" fontWeight="700" fill={pal.text} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {money(totalExpenditure(trip.expenses))}
        </text>
      </g>

      {children}
    </>
  );
}

export default memo(MapScene);
