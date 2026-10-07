import { useId, useMemo, useRef, useState } from 'react';
import { useAppState } from '../../hooks/useAppState.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { isDuplicateName } from '../../hooks/appReducer.js';
import { computeBalances, expenseCountFor } from '../../utils/balances.js';
import { formatMoney } from '../../utils/money.js';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import Modal from '../ui/Modal.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Avatar from '../ui/Avatar.jsx';
import PersonSheet from './PersonSheet.jsx';
import { CameraIcon, PencilIcon, PlusIcon, TrashIcon, UsersIcon } from '../ui/Icons.jsx';

const MAX_NAME = 30;

function validateName(trip, name, exceptId) {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a name.';
  if (trimmed.length > MAX_NAME) return `Keep names under ${MAX_NAME} characters.`;
  if (isDuplicateName(trip, trimmed, exceptId)) return `“${trimmed}” is already on this trip.`;
  return null;
}

export default function PeopleTab({ trip }) {
  const { dispatch, commit, currency } = useAppState();
  const toast = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // participant id
  const [removing, setRemoving] = useState(null); // participant
  const [blocked, setBlocked] = useState(null); // { person, count }
  const inputRef = useRef(null);
  const inputId = useId();

  const balances = useMemo(
    () => Object.fromEntries(computeBalances(trip.participants, trip.expenses).map((b) => [b.id, b])),
    [trip],
  );

  const add = (e) => {
    e.preventDefault();
    const err = validateName(trip, name);
    setError(err);
    if (err) return inputRef.current?.focus();
    dispatch({ type: 'ADD_PARTICIPANT', tripId: trip.id, name });
    toast(`${name.trim()} added`);
    setName('');
    inputRef.current?.focus(); // keep the keyboard up for adding the next friend
  };

  const editingPerson = editing && trip.participants.find((p) => p.id === editing);

  const requestRemove = (p) => {
    const count = expenseCountFor(p.id, trip.expenses);
    if (count > 0) setBlocked({ person: p, count });
    else setRemoving(p);
  };

  return (
    <section aria-labelledby="people-heading" className="space-y-4">
      <h2 id="people-heading" className="sr-only">
        People
      </h2>

      <form onSubmit={add} noValidate className="card p-4">
        <label htmlFor={inputId} className="label">
          Add a person
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            ref={inputRef}
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Name"
            maxLength={MAX_NAME + 10}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="done"
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-err` : undefined}
          />
          <button type="submit" className="btn-primary px-5">
            <PlusIcon /> Add
          </button>
        </div>
        {error && (
          <p id={`${inputId}-err`} className="field-error">
            {error}
          </p>
        )}
      </form>

      {trip.participants.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Who’s on this trip?">
          Add everyone travelling with you, including yourself. You can then log expenses and split them.
        </EmptyState>
      ) : (
        <ul className="card divide-y divide-zinc-100 dark:divide-zinc-800" aria-label="Participants">
          {trip.participants.map((p) => {
            const b = balances[p.id];
            const count = expenseCountFor(p.id, trip.expenses);
            return (
              <li key={p.id} className="flex min-h-16 items-center gap-3 py-2 pr-2 pl-4">
                <button
                  type="button"
                  className="relative shrink-0 rounded-full"
                  onClick={() => setEditing(p.id)}
                  aria-label={p.photo ? `Change ${p.name}’s photo` : `Add a photo for ${p.name}`}
                >
                  <Avatar trip={trip} id={p.id} name={p.name} size="lg" />
                  {!p.photo && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-0.5 -bottom-0.5 flex size-[18px] items-center justify-center rounded-full border-2 border-white bg-zinc-900 text-white dark:border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      <CameraIcon className="size-2.5" strokeWidth={2.5} />
                    </span>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{p.name}</p>
                  <p className="num text-[13px] text-zinc-500 dark:text-zinc-400">
                    {count === 0
                      ? 'No expenses yet'
                      : `Paid ${formatMoney(b.paid, currency)} · ${count} expense${count === 1 ? '' : 's'}`}
                  </p>
                </div>
                {count > 0 && (
                  <span className={`num mr-1 text-sm font-medium ${b.net > 0 ? 'pos' : b.net < 0 ? 'neg' : 'text-zinc-400'}`}>
                    {b.net > 0 ? '+' : ''}
                    {formatMoney(b.net, currency)}
                  </span>
                )}
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Edit ${p.name}`}
                  onClick={() => setEditing(p.id)}
                >
                  <PencilIcon />
                </button>
                <button
                  type="button"
                  className="icon-btn hover:text-red-600"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => requestRemove(p)}
                >
                  <TrashIcon />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {trip.participants.length > 0 && trip.expenses.length === 0 && (
        <p className="px-1 text-center text-[13px] text-zinc-500 dark:text-zinc-400">
          Everyone’s here? Tap <span className="font-medium text-zinc-900 dark:text-zinc-100">Add expense</span> to log the
          first payment.
        </p>
      )}

      {editingPerson && (
        <PersonSheet
          trip={trip}
          person={editingPerson}
          validateName={(n, id) => validateName(trip, n, id)}
          onClose={() => setEditing(null)}
          onSave={({ name: n, photo, upi, qr }) => {
            // commit() saves first and only applies the change if storage accepted it.
            const ok = commit({
              type: 'UPDATE_PARTICIPANT',
              tripId: trip.id,
              id: editingPerson.id,
              name: n,
              photo,
              upi,
              qr,
            });
            if (ok) {
              toast('Saved');
              setEditing(null);
            }
            return ok;
          }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          message={`${removing.name} isn’t part of any expense yet, so removing them won’t change any balances.`}
          confirmLabel="Remove"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            dispatch({ type: 'REMOVE_PARTICIPANT', tripId: trip.id, id: removing.id });
            toast(`${removing.name} removed`);
            setRemoving(null);
          }}
        />
      )}

      {blocked && (
        <Modal
          title={`Can’t remove ${blocked.person.name}`}
          onClose={() => setBlocked(null)}
          size="sm"
          footer={
            <button type="button" className="btn-primary w-full" onClick={() => setBlocked(null)} autoFocus>
              Got it
            </button>
          }
        >
          <p className="text-zinc-600 dark:text-zinc-300">
            {blocked.person.name} paid for or shares in <strong>{blocked.count}</strong> expense
            {blocked.count === 1 ? '' : 's'}. Removing them would break the balances.
          </p>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Edit or delete those expenses first (filter the Expenses tab by {blocked.person.name} to find them), or just
            rename this person instead.
          </p>
        </Modal>
      )}
    </section>
  );
}
