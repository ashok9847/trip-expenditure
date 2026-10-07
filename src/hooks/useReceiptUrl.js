import { useEffect, useState } from 'react';
import { getReceipt } from '../storage/receipts.js';

/**
 * Load a stored bill and expose it as an object URL (revoked on unmount).
 * @returns {{ url: string|null, type: string|null, status: 'idle'|'loading'|'ready'|'missing' }}
 */
export function useReceiptUrl(receiptId) {
  const [result, setResult] = useState({ url: null, type: null, status: receiptId ? 'loading' : 'idle' });

  useEffect(() => {
    if (!receiptId) {
      setResult({ url: null, type: null, status: 'idle' });
      return;
    }
    let url = null;
    let cancelled = false;
    setResult({ url: null, type: null, status: 'loading' });
    getReceipt(receiptId)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) return setResult({ url: null, type: null, status: 'missing' });
        url = URL.createObjectURL(blob);
        setResult({ url, type: blob.type, status: 'ready' });
      })
      .catch(() => !cancelled && setResult({ url: null, type: null, status: 'missing' }));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [receiptId]);

  return result;
}
