export default function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      {Icon && (
        <div className="mb-5 flex size-12 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <Icon className="size-6" />
        </div>
      )}
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {children && <div className="mt-1.5 max-w-xs text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
