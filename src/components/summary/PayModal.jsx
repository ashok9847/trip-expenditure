import { useEffect, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Avatar from '../ui/Avatar.jsx';
import { CopyIcon } from '../ui/Icons.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { formatMoney } from '../../utils/money.js';
import { buildUpiLink } from '../../utils/pay.js';
import { copyText } from '../../utils/download.js';

/**
 * Pay sheet for one settle-up payment (R12.8–R12.13, R12.18): recipient QR
 * (tap to enlarge), UPI deep link for ₹, copyable UPI ID and a paid toggle.
 */
export default function PayModal({ trip, payment, currency, paid, onToggle, onClose }) {
  const toast = useToast();
  const [enlarged, setEnlarged] = useState(false);
  const person = (id) => trip.participants.find((p) => p.id === id) ?? { id, name: 'Unknown', upi: null, qr: null };
  const from = person(payment.from);
  const to = person(payment.to);
  const amount = payment.amount;

  // Escape on the enlarged QR closes only the overlay. Capture phase + preventDefault
  // stops the native <dialog> from firing its 'cancel' (which would close the sheet).
  useEffect(() => {
    if (!enlarged) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setEnlarged(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enlarged]);

  const onCopy = async () => {
    if (await copyText(to.upi)) toast('UPI ID copied');
    else toast('Couldn’t copy the UPI ID', 'error');
  };

  return (
    <Modal
      title={`Pay ${to.name}`}
      description={`${from.name} → ${to.name}`}
      // Fallback: if a close request still reaches the sheet while the QR is enlarged, close the overlay only.
      onClose={() => (enlarged ? setEnlarged(false) : onClose())}
      footer={
        <button type="button" className={`${paid ? 'btn-secondary' : 'btn-primary'} w-full`} onClick={onToggle}>
          {paid ? 'Mark as unpaid' : 'Mark as paid'}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2 pt-1">
          <Avatar trip={trip} id={to.id} name={to.name} size="lg" />
          <p className="num text-3xl font-semibold tracking-tight">{formatMoney(amount, currency)}</p>
        </div>

        {to.qr ? (
          <button
            type="button"
            aria-label="Enlarge QR"
            className="mx-auto block w-full max-w-[320px] rounded-xl bg-white p-2 ring-1 ring-zinc-200 dark:ring-zinc-700"
            onClick={() => setEnlarged(true)}
          >
            <img
              src={to.qr}
              alt={`Payment QR for ${to.name}`}
              className="mx-auto w-full min-w-[min(240px,100%)] max-w-[320px]"
            />
          </button>
        ) : (
          <p className="rounded-xl bg-zinc-50 p-4 text-center text-sm text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
            {to.name} hasn’t added a Payment QR yet. You can add one for them in the People tab.
          </p>
        )}

        {currency === '₹' && to.upi && (
          <a className="btn-primary w-full" href={buildUpiLink(to, amount, trip.name)}>
            Open UPI app
          </a>
        )}

        {to.upi && (
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-700">
            <span className="min-w-0 flex-1 truncate font-mono text-sm select-all">{to.upi}</span>
            <button type="button" className="btn-secondary min-h-11" onClick={onCopy} aria-label="Copy UPI ID">
              <CopyIcon className="size-4" />
              Copy
            </button>
          </div>
        )}
      </div>

      {enlarged && to.qr && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close enlarged QR"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setEnlarged(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setEnlarged(false);
            }
          }}
          ref={(el) => el?.focus()}
        >
          <img src={to.qr} alt={`Payment QR for ${to.name}`} className="h-full w-full object-contain" />
        </div>
      )}
    </Modal>
  );
}
