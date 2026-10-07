import { useId, useMemo, useState } from 'react';
import { useAppState } from '../../hooks/useAppState.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { formatMoney } from '../../utils/money.js';
import { formatDateTime, formatDayHeader, formatTime, toLocalDateKey } from '../../utils/dates.js';
import { computeShares } from '../../utils/splits.js';
import { totalExpenditure } from '../../utils/balances.js';
import { deleteReceipt } from '../../storage/receipts.js';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Avatar from '../ui/Avatar.jsx';
import ExpenseDetail from './ExpenseDetail.jsx';
import { PaperclipIcon, ReceiptIcon, UsersIcon } from '../ui/Icons.jsx';

export default function ExpenseLog({ trip, filters, onFiltersChange, onEdit, onGoToPeople, onAdd }) {
  const { dispatch, currency } = useAppState();
  const toast = useToast();
  const [detail, setDetail] = useState(null); // expense id
  const [deleting, setDeleting] = useState(null);
  const uid = useId();
  const money = (v) => formatMoney(v, currency);

  const byId = useMemo(() => new Map(trip.participants.map((p) => [p.id, p])), [trip.participants]);
  const nameOf = (id) => byId.get(id)?.name ?? 'Unknown';

  const sorted = useMemo(
    () => [...trip.expenses].sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime)),
    [trip.expenses],
  );
  const days = useMemo(() => [...new Set(sorted.map((e) => toLocalDateKey(e.dateTime)))], [sorted]);

  const person = byId.has(filters.person) ? filters.person : '';
  const date = days.includes(filters.date) ? filters.date : '';
  const filtered = sorted.filter(
    (e) =>
      (!person || e.paidBy === person || e.participantIds.includes(person)) &&
      (!date || toLocalDateKey(e.dateTime) === date),
  );

  const groups = [];
  for (const e of filtered) {
    const key = toLocalDateKey(e.dateTime);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(e);
    else groups.push({ key, label: formatDayHeader(e.dateTime), items: [e] });
  }

  if (trip.participants.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="Add your travel group"
        action={
          <button type="button" className="btn-primary" onClick={onGoToPeople}>
            Add people
          </button>
        }
      >
        Expenses are split between the people on the trip. Add everyone, including yourself.
      </EmptyState>
    );
  }

  if (trip.expenses.length === 0) {
    return (
      <EmptyState
        icon={ReceiptIcon}
        title="No expenses yet"
        action={
          <button type="button" className="btn-primary" onClick={onAdd}>
            Add the first expense
          </button>
        }
      >
        Whenever someone pays for something, add it here. Balances update automatically.
      </EmptyState>
    );
  }

  const total = totalExpenditure(trip.expenses);
  const filtering = person || date;
  const personShare = person
    ? filtered.reduce((s, e) => s + (e.participantIds.includes(person) ? computeShares(e)[person] : 0), 0)
    : 0;
  const detailExpense = trip.expenses.find((e) => e.id === detail);

  return (
    <section aria-label="Expense log" className="space-y-5">
      {/* Headline */}
      <div className="card flex items-end justify-between gap-4 p-4">
        <div>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Total spent</p>
          <p className="num mt-0.5 text-[30px] leading-none font-semibold tracking-tight">{money(total)}</p>
        </div>
        <div className="text-right text-[13px] text-zinc-500 dark:text-zinc-400">
          <p>
            <span className="num font-medium text-zinc-900 dark:text-zinc-100">{sorted.length}</span> expenses
          </p>
          <p>
            <span className="num font-medium text-zinc-900 dark:text-zinc-100">
              {money(Math.round(total / trip.participants.length))}
            </span>{' '}
            per person
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <label htmlFor={`${uid}-person`} className="sr-only">
          Filter by person
        </label>
        <select
          id={`${uid}-person`}
          className="input h-10 flex-1 appearance-auto text-sm"
          value={person}
          onChange={(e) => onFiltersChange({ ...filters, person: e.target.value })}
        >
          <option value="">All people</option>
          {trip.participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label htmlFor={`${uid}-date`} className="sr-only">
          Filter by date
        </label>
        <select
          id={`${uid}-date`}
          className="input h-10 flex-1 appearance-auto text-sm"
          value={date}
          onChange={(e) => onFiltersChange({ ...filters, date: e.target.value })}
        >
          <option value="">All dates</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {formatDayHeader(`${d}T12:00:00`)}
            </option>
          ))}
        </select>
      </div>

      {filtering && (
        <div className="-mt-2 flex items-center justify-between text-[13px] text-zinc-500 dark:text-zinc-400" aria-live="polite">
          <span>
            {filtered.length} of {sorted.length} · {money(totalExpenditure(filtered))}
            {person && ` · ${nameOf(person)}’s share ${money(personShare)}`}
          </span>
          <button
            type="button"
            className="h-9 px-1 font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
            onClick={() => onFiltersChange({ person: '', date: '' })}
          >
            Clear
          </button>
        </div>
      )}

      {filtered.length === 0 && <p className="card p-8 text-center text-sm text-zinc-500">No expenses match these filters.</p>}

      {groups.map((g) => (
        <div key={g.key}>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">{g.label}</h2>
            <span className="num text-[13px] text-zinc-400">{money(totalExpenditure(g.items))}</span>
          </div>
          <ul className="card divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
            {g.items.map((e) => {
              const others = e.participantIds.filter((id) => id !== e.paidBy);
              const everyone = e.participantIds.length === trip.participants.length && trip.participants.length > 1;
              const splitText = everyone
                ? `split with everyone`
                : others.length === 0
                  ? 'just for themselves'
                  : `split with ${others.map(nameOf).join(', ')}`;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    className="list-row transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-800/50 dark:active:bg-zinc-800"
                    onClick={() => setDetail(e.id)}
                    aria-label={`${nameOf(e.paidBy)} paid ${money(e.amount)} for ${e.description} on ${formatDateTime(e.dateTime)}, split among ${e.participantIds.map(nameOf).join(', ')}`}
                  >
                    <Avatar trip={trip} id={e.paidBy} name={nameOf(e.paidBy)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[15px] font-medium">{e.description}</span>
                        {e.category && (
                          <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {e.category}
                          </span>
                        )}
                        {e.receiptId && <PaperclipIcon className="size-3.5 shrink-0 text-zinc-400" />}
                        {e.splitMode === 'custom' && (
                          <span className="shrink-0 rounded border border-zinc-200 px-1 text-[10px] font-medium text-zinc-500 dark:border-zinc-700">
                            CUSTOM
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[13px] text-zinc-500 dark:text-zinc-400">
                        {nameOf(e.paidBy)} paid, {splitText}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="num block text-[15px] font-semibold">{money(e.amount)}</span>
                      <span className="block text-xs text-zinc-400">
                        {person && e.participantIds.includes(person)
                          ? `${nameOf(person)}: ${money(computeShares(e)[person])}`
                          : formatTime(e.dateTime)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {detailExpense && (
        <ExpenseDetail
          trip={trip}
          expense={detailExpense}
          currency={currency}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setDetail(null);
            onEdit(detailExpense);
          }}
          onDelete={() => setDeleting(detailExpense)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this expense?"
          message={`${nameOf(deleting.paidBy)} paid ${money(deleting.amount)} for ${deleting.description}. Balances will be recalculated. This can’t be undone.`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            dispatch({ type: 'DELETE_EXPENSE', tripId: trip.id, id: deleting.id });
            if (deleting.receiptId) deleteReceipt(deleting.receiptId).catch(() => {});
            toast('Expense deleted');
            setDeleting(null);
            setDetail(null);
          }}
        />
      )}
    </section>
  );
}
