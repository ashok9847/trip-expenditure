import { personColor } from '../../utils/journey.js';

const SIZES = {
  xs: 'size-5 text-[10px]',
  sm: 'size-7 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-11 text-base',
  xl: 'size-24 text-3xl',
};

export const initials = (name) => {
  const parts = String(name || '?').trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 1)).toUpperCase();
};

/**
 * Person avatar: their photo if they added one, otherwise tinted initials.
 * Colour is stable per participant.
 */
export default function Avatar({ trip, id, name, size = 'md', ring = false, className = '', photo }) {
  const color = personColor(trip, id);
  const src = photo !== undefined ? photo : trip?.participants.find((p) => p.id === id)?.photo;
  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${SIZES[size]} ${
    ring ? 'ring-2 ring-white dark:ring-zinc-900' : ''
  } ${className}`;
  if (src) {
    return (
      <span aria-hidden="true" className={base}>
        <img src={src} alt="" className="size-full object-cover" draggable="false" />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={base} style={{ backgroundColor: `${color}1f`, color }}>
      {initials(name)}
    </span>
  );
}
