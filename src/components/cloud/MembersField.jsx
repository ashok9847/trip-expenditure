import { useId, useState } from 'react';
import { useCloud } from '../../cloud/CloudProvider.jsx';
import { useAppState } from '../../hooks/useAppState.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { isEmail, MAX_MEMBERS, normEmail } from '../../storage/storage.js';
import GoogleButton from './GoogleButton.jsx';
import { XIcon } from '../ui/Icons.jsx';

/**
 * "Shared with" editor for one trip. Only the owner can add or remove people;
 * anyone added signs in with that Google account and sees the trip live.
 */
export default function MembersField({ trip }) {
  const { enabled, status, user } = useCloud();
  const { dispatch } = useAppState();
  const toast = useToast();
  const uid = useId();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);

  if (!enabled) return null;
  if (status !== 'signed-in') {
    return (
      <section className="space-y-2 border-t border-zinc-100 pt-5 dark:border-zinc-800">
        <p className="label mb-0">Share this trip</p>
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Sign in so friends can add expenses to this trip from their own phones.</p>
        <GoogleButton />
      </section>
    );
  }
  if (!trip.cloud) return null; // being uploaded

  const isOwner = trip.cloud.ownerUid === user.uid;
  const others = trip.cloud.memberEmails.filter((e) => e !== trip.cloud.ownerEmail);

  const add = (e) => {
    e.preventDefault();
    const v = normEmail(email);
    if (!isEmail(v)) return setError('Enter a valid email address.');
    if (trip.cloud.memberEmails.includes(v)) return setError('That person already has access.');
    if (trip.cloud.memberEmails.length >= MAX_MEMBERS) return setError(`A trip can be shared with up to ${MAX_MEMBERS} people.`);
    dispatch({ type: 'SET_MEMBERS', tripId: trip.id, memberEmails: [...others, v] });
    setEmail('');
    setError(null);
    toast(`${v} can now open this trip`);
  };

  return (
    <section className="space-y-3 border-t border-zinc-100 pt-5 dark:border-zinc-800" aria-labelledby={`${uid}-h`}>
      <div>
        <p id={`${uid}-h`} className="label mb-0">
          Shared with
        </p>
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
          {isOwner
            ? 'People you add sign in with that Google account and can view and add expenses.'
            : `Shared by ${trip.cloud.ownerEmail}. Only they can change who has access.`}
        </p>
      </div>
      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        <li className="flex min-h-11 items-center gap-2 px-3 text-sm">
          <span className="min-w-0 flex-1 truncate">{trip.cloud.ownerEmail}</span>
          <span className="text-xs text-zinc-500">Owner</span>
        </li>
        {others.map((m) => (
          <li key={m} className="flex min-h-11 items-center gap-2 px-3 text-sm">
            <span className="min-w-0 flex-1 truncate">{m}</span>
            {m === user.email && <span className="text-xs text-zinc-500">You</span>}
            {isOwner && (
              <button
                type="button"
                className="icon-btn size-9"
                aria-label={`Remove ${m}`}
                onClick={() => dispatch({ type: 'SET_MEMBERS', tripId: trip.id, memberEmails: others.filter((x) => x !== m) })}
              >
                <XIcon className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <form onSubmit={add} noValidate className="space-y-1.5">
          <label htmlFor={`${uid}-email`} className="sr-only">
            Friend’s Google email
          </label>
          <div className="flex gap-2">
            <input
              id={`${uid}-email`}
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              className="input h-11 flex-1"
              placeholder="friend@gmail.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              aria-invalid={!!error}
              aria-describedby={error ? `${uid}-err` : undefined}
            />
            <button type="submit" className="btn-primary h-11">
              Add
            </button>
          </div>
          {error && (
            <p id={`${uid}-err`} className="field-error">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
