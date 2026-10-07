import { useReceiptUrl } from '../../hooks/useReceiptUrl.js';
import { FileIcon } from '../ui/Icons.jsx';

/** Small tappable thumbnail shown on an expense card when a bill is attached. */
export default function BillThumb({ receiptId, label, onClick }) {
  const { url, type, status } = useReceiptUrl(receiptId);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View bill for ${label}`}
      className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-200 py-1 pr-3 pl-1 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      <span className="flex size-9 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
        {status === 'ready' && type !== 'application/pdf' ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <FileIcon className={`size-5 ${status === 'missing' ? 'text-zinc-400' : 'text-zinc-900'}`} />
        )}
      </span>
      {status === 'missing' ? 'Bill missing' : 'View bill'}
    </button>
  );
}
