import { useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Avatar from '../ui/Avatar.jsx';
import BillThumb from '../bills/BillThumb.jsx';
import BillViewer from '../bills/BillViewer.jsx';
import { formatMoney } from '../../utils/money.js';
import { formatDateTime } from '../../utils/dates.js';
import { computeShares } from '../../utils/splits.js';

/** Read-only view of one expense with its split, bill, and edit/delete actions. */
export default function ExpenseDetail({ trip, expense, currency, onEdit, onDelete, onClose }) {
  const [viewingBill, setViewingBill] = useState(false);
  const byId = new Map(trip.participants.map((p) => [p.id, p]));
  const nameOf = (id) => byId.get(id)?.name ?? 'Unknown';
  const shares = computeShares(expense);
  const money = (v) => formatMoney(v, currency);

  return (
    <Modal
      title={expense.description}
      description={formatDateTime(expense.dateTime)}
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary text-red-600 dark:text-red-400" onClick={onDelete}>
            Delete
          </button>
          <button type="button" className="btn-primary" onClick={onEdit}>
            Edit
          </button>
        </div>
      }
    >
      <p className="num text-[34px] font-semibold tracking-tight">{money(expense.amount)}</p>
      <div className="mt-1 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Avatar trip={trip} id={expense.paidBy} name={nameOf(expense.paidBy)} size="xs" />
        Paid by <span className="font-medium text-zinc-900 dark:text-zinc-100">{nameOf(expense.paidBy)}</span>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="eyebrow">Split {expense.splitMode === 'custom' ? 'by amount' : 'equally'}</p>
          <p className="text-xs text-zinc-500">
            {expense.participantIds.length} {expense.participantIds.length === 1 ? 'person' : 'people'}
          </p>
        </div>
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {expense.participantIds.map((id) => (
            <li key={id} className="flex items-center gap-3 px-3.5 py-2.5">
              <Avatar trip={trip} id={id} name={nameOf(id)} size="sm" />
              <span className="flex-1 truncate text-[15px]">{nameOf(id)}</span>
              {id === expense.paidBy ? (
                <span className="text-xs text-zinc-400">own share</span>
              ) : (
                <span className="text-xs text-zinc-400">owes {nameOf(expense.paidBy)}</span>
              )}
              <span className="num w-20 text-right text-[15px] font-medium">{money(shares[id])}</span>
            </li>
          ))}
        </ul>
      </div>

      {expense.receiptId && (
        <div className="mt-6">
          <p className="eyebrow mb-2">Bill</p>
          <BillThumb receiptId={expense.receiptId} label={expense.description} onClick={() => setViewingBill(true)} />
        </div>
      )}

      {viewingBill && (
        <BillViewer receiptId={expense.receiptId} title={expense.description} onClose={() => setViewingBill(false)} />
      )}
    </Modal>
  );
}
