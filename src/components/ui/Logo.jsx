/** TripSplit mark: a circle split into two halves. */
export default function Logo({ className = 'size-7' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" className="fill-zinc-900 dark:fill-zinc-100" />
      <path d="M29 16a16 16 0 0 0 0 32z" className="fill-white dark:fill-zinc-900" />
      <path d="M35 16a16 16 0 0 1 0 32z" fill="#34d399" />
    </svg>
  );
}
