import { useId, useRef } from 'react';
import { CameraIcon, FileIcon, TrashIcon, UploadIcon } from '../ui/Icons.jsx';

/**
 * Optional bill / receipt attachment for an expense.
 * Shows "Take photo" (opens the camera on phones) and "Upload" (gallery or PDF),
 * or a preview with Replace / Remove once a bill is attached.
 */
export default function BillField({ previewUrl, previewType, loading, busy, error, onPick, onRemove, onView }) {
  const uid = useId();
  const cameraRef = useRef(null);
  const uploadRef = useRef(null);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (file) onPick(file);
  };

  const hasBill = !!previewUrl || loading;
  const isPdf = previewType === 'application/pdf';

  return (
    <div role="group" aria-labelledby={`${uid}-label`} aria-describedby={error ? `${uid}-err` : undefined}>
      <p id={`${uid}-label`} className="label">
        Bill / receipt <span className="font-normal text-zinc-500">(optional)</span>
      </p>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChange} tabIndex={-1} aria-hidden="true" />
      <input ref={uploadRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleChange} tabIndex={-1} aria-hidden="true" data-testid="bill-upload" />

      {hasBill ? (
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-2 dark:border-zinc-800">
          <button
            type="button"
            onClick={onView}
            disabled={!previewUrl}
            className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800"
            aria-label="View attached bill"
          >
            {loading || busy ? (
              <span className="text-xs text-zinc-500">Loading…</span>
            ) : isPdf ? (
              <FileIcon className="size-8 text-red-600" />
            ) : (
              <img src={previewUrl} alt="" className="size-full object-cover" />
            )}
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-sm font-medium">{isPdf ? 'PDF bill attached' : 'Bill photo attached'}</p>
            <div className="flex gap-1">
              <button type="button" className="btn-ghost min-h-10 px-2" onClick={() => uploadRef.current?.click()} disabled={busy}>
                <UploadIcon className="size-4" /> Replace
              </button>
              <button type="button" className="btn-ghost min-h-10 px-2 text-red-600 dark:text-red-400" onClick={onRemove} disabled={busy}>
                <TrashIcon className="size-4" /> Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary min-h-12" onClick={() => cameraRef.current?.click()} disabled={busy}>
            <CameraIcon /> Take photo
          </button>
          <button type="button" className="btn-secondary min-h-12" onClick={() => uploadRef.current?.click()} disabled={busy}>
            <UploadIcon /> Upload
          </button>
        </div>
      )}
      {busy && !hasBill && <p className="mt-1.5 text-sm text-zinc-500">Processing photo…</p>}
      {error && (
        <p id={`${uid}-err`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
