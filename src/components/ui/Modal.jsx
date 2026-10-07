import { useEffect, useId, useRef } from 'react';
import { XIcon } from './Icons.jsx';

/**
 * Accessible modal built on the native <dialog> element (focus trap, Escape,
 * inert background). Bottom sheet on phones, centred panel on larger screens.
 * Mount it only while open.
 */
export default function Modal({ title, description, onClose, children, footer, size = 'md' }) {
  const ref = useRef(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    const previouslyFocused = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();

    const onCancel = (e) => {
      e.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      if (dialog.open) dialog.close();
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, []);

  const width = size === 'sm' ? 'sm:max-w-sm' : 'sm:max-w-md';

  return (
    <dialog
      ref={ref}
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`mx-auto mt-auto mb-0 max-h-[94dvh] w-full max-w-none overflow-hidden rounded-t-2xl bg-white text-zinc-900 shadow-xl ring-1 ring-zinc-900/5 backdrop:bg-zinc-950/40 sm:my-auto sm:rounded-2xl dark:bg-zinc-900 dark:text-zinc-100 dark:ring-white/10 ${width}`}
    >
      <div className="flex max-h-[94dvh] flex-col">
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-zinc-200 sm:hidden dark:bg-zinc-700" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-3 sm:pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[17px] font-semibold tracking-tight">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
          </div>
          <button type="button" className="icon-btn -mt-1 -mr-2" onClick={onClose} aria-label="Close">
            <XIcon className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer && (
          <div className="border-t border-zinc-100 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-zinc-800">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}
