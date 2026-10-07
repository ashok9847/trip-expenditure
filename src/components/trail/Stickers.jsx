// Hand-drawn flat-vector icon set. Every icon: 64x64 art box, 2.5px ink
// outline, the same 5-colour palette. The `Sticker` wrapper places the art in
// a clean stop-marker disc. Emoji appear only for AI-classified things with no
// SVG art.
import { ACCENT, SCENE_RING, SCENE_TINT } from './palette.js';

// Icon-art colours (local to the sticker set).
const INK = '#1D1D2B';
const CREAM = '#F4F1EA';
const RIVER = '#7CC8E8';
const FOREST = '#3E7D4F';
const SUNSET = ACCENT;
const GOLD = '#F2B632';

const S = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round', strokeLinecap: 'round' };
const W = '#FFFFFF';
const Wheel = ({ x, y, r = 4.5 }) => (
  <>
    <circle cx={x} cy={y} r={r} fill={INK} />
    <circle cx={x} cy={y} r={1.5} fill={CREAM} />
  </>
);

const ART = {
  rickshaw: (
    <>
      <path d="M17 38V29q0-8 9-8h11q9 0 9 9v8z" fill={GOLD} {...S} />
      <path d="M20 25.5h11" stroke={SUNSET} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M17 33h29v6H17z" fill={FOREST} {...S} />
      <path d="M36 24h5q3 0 3 6h-8z" fill={RIVER} {...S} strokeWidth="2" />
      <Wheel x={23} y={41} />
      <Wheel x={42} y={41} />
    </>
  ),
  bike: (
    <>
      <circle cx="21" cy="41" r="6" fill={W} {...S} />
      <circle cx="44" cy="41" r="6" fill={W} {...S} />
      <path d="M40 31l4 10" fill="none" {...S} />
      <path d="M24 33h13l-2 8H22q-2-8 2-8z" fill={SUNSET} {...S} />
      <path d="M26 29h9" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M37 33l5-8h4M44 25l-2-6h5" fill="none" {...S} />
    </>
  ),
  fuel: (
    <>
      <rect x="18" y="16" width="20" height="32" rx="3" fill={SUNSET} {...S} />
      <rect x="22" y="20" width="12" height="9" rx="1.5" fill={W} {...S} strokeWidth="2" />
      <path d="M28 33q-3 4 0 6 3-2 0-6z" fill={GOLD} {...S} strokeWidth="1.8" />
      <path d="M38 22h3q4 0 4 4v13q0 4-3 4" fill="none" {...S} />
      <rect x="39" y="41" width="6" height="6" rx="1" fill={INK} />
      <path d="M15 48h26" {...S} />
    </>
  ),
  plane: (
    <>
      <path d="M30 30l-5-10h5l9 10z" fill={RIVER} {...S} />
      <path d="M16 31l-3-9h5l5 8" fill={SUNSET} {...S} />
      <path d="M13 34q0-4 5-4h26q8 1 9 4-1 3-9 4H18q-5 0-5-4z" fill={W} {...S} />
      <path d="M28 34l-7 12h6l11-12z" fill={RIVER} {...S} />
      <circle cx="33" cy="33.5" r="1.3" fill={INK} />
      <circle cx="38" cy="33.5" r="1.3" fill={INK} />
      <circle cx="43" cy="33.5" r="1.3" fill={INK} />
    </>
  ),
  train: (
    <>
      <path d="M21 51l4-6M43 51l-4-6M19 49h26" fill="none" {...S} />
      <rect x="19" y="15" width="26" height="30" rx="7" fill={FOREST} {...S} />
      <rect x="23" y="19" width="18" height="10" rx="2" fill={RIVER} {...S} strokeWidth="2" />
      <circle cx="25" cy="37" r="2.5" fill={GOLD} {...S} strokeWidth="1.5" />
      <circle cx="39" cy="37" r="2.5" fill={GOLD} {...S} strokeWidth="1.5" />
    </>
  ),
  bus: (
    <>
      <rect x="13" y="19" width="38" height="24" rx="5" fill={GOLD} {...S} />
      <rect x="17" y="23" width="9" height="8" rx="1.5" fill={RIVER} {...S} strokeWidth="2" />
      <rect x="28" y="23" width="9" height="8" rx="1.5" fill={RIVER} {...S} strokeWidth="2" />
      <rect x="39" y="23" width="8" height="8" rx="1.5" fill={RIVER} {...S} strokeWidth="2" />
      <path d="M13 35h38" {...S} />
      <Wheel x={21} y={44} r={4} />
      <Wheel x={43} y={44} r={4} />
    </>
  ),
  hotel: (
    <>
      <path d="M15 50h34" {...S} />
      <rect x="19" y="20" width="26" height="30" fill={SUNSET} {...S} />
      <rect x="25" y="12" width="14" height="8" rx="1.5" fill={GOLD} {...S} strokeWidth="2" />
      <path d="M30 14v4M34 14v4M30 16h4" stroke={INK} strokeWidth="1.6" />
      {[23, 30, 37].flatMap((x) =>
        [24, 32].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="4" height="5" fill={W} stroke={INK} strokeWidth="1.5" />),
      )}
      <path d="M29 50v-7h6v7" fill={INK} />
    </>
  ),
  plate: (
    <>
      <circle cx="33" cy="33" r="13" fill={W} {...S} />
      <circle cx="33" cy="33" r="8" fill={CREAM} stroke={INK} strokeWidth="1.6" />
      <path d="M29 31q4-4 8 0-4 4-8 0z" fill={SUNSET} stroke={INK} strokeWidth="1.4" />
      <path d="M15 18v8q0 3 2.5 3v19M17.5 18v8M20 18v8q0 3-2.5 3" fill="none" {...S} strokeWidth="2.2" />
      <path d="M50 18q4 7 0 14v16M50 18v14" fill="none" {...S} strokeWidth="2.2" />
    </>
  ),
  chai: (
    <>
      <path d="M27 19q-2-3 1-6M34 19q-2-3 1-6" fill="none" {...S} strokeWidth="2" />
      <path d="M42 28q7 0 6 7-1 5-7 4" fill="none" {...S} />
      <path d="M20 24h22l-2 20q-1 4-5 4h-8q-4 0-5-4z" fill={SUNSET} {...S} />
      <path d="M22 29h18" stroke={CREAM} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  beer: (
    <>
      <g transform="rotate(-10 24 34)">
        <path d="M30 28h3q3 0 3 3v5q0 3-3 3h-3" fill="none" {...S} />
        <rect x="16" y="24" width="14" height="20" rx="2" fill={GOLD} {...S} />
        <path d="M15 25q0-5 4-4 2-4 6-1 4-2 6 2 1 3-1 4H16q-2 0-1-1z" fill={W} {...S} strokeWidth="2" />
      </g>
      <g transform="rotate(10 40 34)">
        <path d="M34 28h-3q-3 0-3 3v5q0 3 3 3h3" fill="none" {...S} />
        <rect x="34" y="24" width="14" height="20" rx="2" fill={GOLD} {...S} />
        <path d="M33 25q0-5 4-4 2-4 6-1 4-2 6 2 1 3-1 4H34q-2 0-1-1z" fill={W} {...S} strokeWidth="2" />
      </g>
    </>
  ),
  pizza: (
    <>
      <path d="M32 14l-14 32q14 5 28 0z" fill={GOLD} {...S} />
      <path d="M18 46q14 5 28 0l-2-5q-12 4-24 0z" fill="#C98A12" {...S} strokeWidth="2" />
      <circle cx="30" cy="30" r="2.8" fill={SUNSET} />
      <circle cx="35" cy="37" r="2.8" fill={SUNSET} />
      <circle cx="27" cy="39" r="2.4" fill={SUNSET} />
    </>
  ),
  cart: (
    <>
      <rect x="27" y="17" width="7" height="10" rx="1.5" fill={FOREST} {...S} strokeWidth="2" />
      <circle cx="38" cy="22" r="5" fill={SUNSET} {...S} strokeWidth="2" />
      <path d="M13 20h5l3 6" fill="none" {...S} />
      <path d="M21 26h28l-4 14H25z" fill={RIVER} {...S} />
      <path d="M25 40l-1 4h21" fill="none" {...S} />
      <circle cx="27" cy="47" r="3" fill={INK} />
      <circle cx="42" cy="47" r="3" fill={INK} />
    </>
  ),
  clapper: (
    <>
      <rect x="16" y="28" width="32" height="20" rx="2" fill={INK} {...S} />
      <path d="M16 28l29-10 2 6-29 10z" fill={W} {...S} />
      <path d="M23 25.5l3 5.5M31 23l3 5.5M39 20l3 5.5" stroke={INK} strokeWidth="2.5" />
      <path d="M21 36h22M21 41h14" stroke={CREAM} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  diver: (
    <>
      <path d="M13 32q0-11 19-11t19 11" fill="none" stroke={INK} strokeWidth="3.5" />
      <path d="M18 26h28q5 0 5 6v4q0 6-6 6h-7l-6-4-6 4h-7q-6 0-6-6v-4q0-6 5-6z" fill={SUNSET} {...S} />
      <rect x="17" y="29" width="12" height="8" rx="3" fill={RIVER} {...S} strokeWidth="2" />
      <rect x="35" y="29" width="12" height="8" rx="3" fill={RIVER} {...S} strokeWidth="2" />
      <path d="M47 38h3V18" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M47 38h3V18" fill="none" stroke={GOLD} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  waves: (
    <>
      <circle cx="42" cy="20" r="6" fill={GOLD} {...S} strokeWidth="2" />
      <circle cx="26" cy="29" r="3.5" fill={SUNSET} {...S} strokeWidth="1.8" />
      <path d="M30 30q4-5 8-2" fill="none" {...S} strokeWidth="2" />
      <path d="M11 34q5-5 10 0t10 0 10 0 10 0v14H11z" fill={RIVER} {...S} />
      <path d="M14 42q4-3 8 0t8 0 8 0 8 0" fill="none" stroke={W} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  mountain: (
    <>
      <circle cx="45" cy="18" r="5" fill={GOLD} {...S} strokeWidth="2" />
      <path d="M9 47l17-27 10 15 6-8 13 20z" fill={FOREST} {...S} />
      <path d="M26 20l-5 8 3-1 2 3 3-3 2 1z" fill={W} {...S} strokeWidth="1.8" />
    </>
  ),
  tent: (
    <>
      <path d="M12 46L32 17l20 29z" fill={FOREST} {...S} />
      <path d="M32 17l-6 29h12z" fill={GOLD} {...S} />
      <path d="M9 46h46" {...S} />
      <path d="M32 17v-5l6 2-6 2" fill={SUNSET} {...S} strokeWidth="1.8" />
    </>
  ),
  bag: (
    <>
      <path d="M25 26v-4q0-6 7-6t7 6v4" fill="none" {...S} />
      <path d="M18 26h28l-2 22H20z" fill={SUNSET} {...S} />
      <path d="M32 33q-3-3-5 0 0 3 5 6 5-3 5-6-2-3-5 0z" fill={W} stroke={INK} strokeWidth="1.6" />
    </>
  ),
  ticket: (
    <g transform="rotate(-12 32 32)">
      <path d="M13 23h38v7q-4 2 0 5v6H13v-6q4-3 0-5z" fill={GOLD} {...S} />
      <path d="M39 24v16" stroke={INK} strokeWidth="2" strokeDasharray="2 3" />
      <path d="M26 26l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z" fill={W} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
    </g>
  ),
  gift: (
    <>
      <path d="M32 24q-9-9-11-3t11 3q9-9 11-3t-11 3z" fill={GOLD} {...S} strokeWidth="2" />
      <rect x="17" y="30" width="30" height="18" fill={SUNSET} {...S} />
      <rect x="15" y="24" width="34" height="7" fill={SUNSET} {...S} />
      <path d="M29 24h6v24h-6z" fill={GOLD} {...S} strokeWidth="2" />
    </>
  ),
  party: (
    <>
      <path d="M17 48l8-24 15 15z" fill={GOLD} {...S} />
      <path d="M21 37l6 6M23 30l10 10" stroke={SUNSET} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="40" cy="20" r="2.5" fill={SUNSET} />
      <rect x="45" y="28" width="4.5" height="4.5" fill={RIVER} transform="rotate(20 47 30)" />
      <path d="M31 16q3 3 0 6" fill="none" stroke={FOREST} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="47" cy="41" r="2" fill={FOREST} />
      <path d="M38 13l1 3M50 20l-3 1" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  medicine: (
    <>
      <g transform="rotate(-35 32 34)">
        <rect x="14" y="27" width="36" height="14" rx="7" fill={W} {...S} />
        <path d="M32 27h11q7 0 7 7t-7 7H32z" fill={SUNSET} {...S} />
      </g>
      <path d="M44 14v8M40 18h8" stroke={FOREST} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  wifi: (
    <>
      <rect x="22" y="15" width="20" height="34" rx="4" fill={INK} {...S} />
      <rect x="25" y="19" width="14" height="23" rx="1.5" fill={RIVER} />
      <path d="M27 29q5-5 10 0M29 32q3-3 6 0" fill="none" stroke={W} strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="35" r="1.3" fill={W} />
      <circle cx="32" cy="45.5" r="1.3" fill={CREAM} />
    </>
  ),
  tips: (
    <>
      {[45, 39, 33].map((y) => (
        <ellipse key={y} cx="28" cy={y} rx="11" ry="4" fill={GOLD} {...S} strokeWidth="2.2" />
      ))}
      <circle cx="44" cy="26" r="7" fill={GOLD} {...S} />
      <path d="M41.5 23h5M41.5 25.5h5M43 23q3 0 3 2.5T42 28l4 3" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  pin: (
    <>
      <path d="M32 50q-13-14-13-24a13 13 0 0 1 26 0q0 10-13 24z" fill={SUNSET} {...S} />
      <circle cx="32" cy="26" r="5" fill={W} {...S} strokeWidth="2" />
    </>
  ),
};

export const STICKER_ART_KINDS = Object.keys(ART);

/**
 * A clean stop marker centred on (0, 0), `size` px wide: light disc, faint
 * scene tint, thin scene-coloured ring and the icon art at ~0.8·size.
 * Never rotated, no shadow, no misregistration. `filter` is accepted for
 * backwards compatibility and ignored.
 * @param {{ kind: string, emoji?: string|null, scene?: string, size: number, disc?: string, filter?: string }} props
 */
// eslint-disable-next-line no-unused-vars
export function Sticker({ kind, emoji, scene = 'misc', size, disc = '#FFFDF8', filter }) {
  const r = size / 2 - 1; // keep the 2px ring inside the `size` box
  const k = (0.8 * size) / 64;
  const tint = SCENE_TINT[scene] ?? SCENE_TINT.misc;
  const ring = SCENE_RING[scene] ?? SCENE_RING.misc;
  const art = kind === 'emoji' && emoji ? null : ART[kind] ?? ART.pin;
  return (
    <g>
      <circle cx="0" cy="0" r={r} fill={disc} />
      <circle cx="0" cy="0" r={r} fill={tint} opacity="0.35" />
      <circle cx="0" cy="0" r={r} fill="none" stroke={ring} strokeWidth="2" />
      {art ? (
        <g className="stk-art" transform={`scale(${k}) translate(-32 -32)`}>
          {art}
        </g>
      ) : (
        <text x="0" y="0" fontSize={size * 0.45} textAnchor="middle" dominantBaseline="central">
          {emoji}
        </text>
      )}
    </g>
  );
}

/** Small standalone preview (used in the Add expense form). */
export function StickerBadge({ sticker, size = 48, title }) {
  return (
    <svg width={size} height={size} viewBox="-34 -34 68 68" role="img" aria-label={title ? `Sticker: ${sticker.kind === 'emoji' ? sticker.emoji : sticker.kind}` : undefined}>
      <Sticker kind={sticker.kind} emoji={sticker.emoji} scene={sticker.scene} size={64} />
    </svg>
  );
}
