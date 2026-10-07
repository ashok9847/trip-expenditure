import { useId, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import { useAppState } from '../../hooks/useAppState.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { formatMoney } from '../../utils/money.js';
import { clearReceipts } from '../../storage/receipts.js';
import { useCloud } from '../../cloud/CloudProvider.jsx';
import GoogleButton from '../cloud/GoogleButton.jsx';

const PRESETS = ['₹', 'Rs', '$', '€', '£', '¥', '฿', 'रु'];
const THEMES = [
  [null, 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

export default function SettingsModal({ onClose }) {
  const { state, dispatch } = useAppState();
  const cloud = useCloud();
  const toast = useToast();
  const uid = useId();
  const [currency, setCurrency] = useState(state.settings.currency);
  const [error, setError] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const saveCurrency = (value) => {
    const v = value.trim();
    if (!v) return setError('Enter a currency symbol.');
    if (v.length > 4) return setError('Use at most 4 characters.');
    setError(null);
    dispatch({ type: 'UPDATE_SETTINGS', patch: { currency: v } });
  };

  return (
    <>
      <Modal title="Settings" onClose={onClose}>
        <div className="space-y-6">
          <div>
            <label htmlFor={`${uid}-cur`} className="label">
              Currency symbol
            </label>
            <div className="flex gap-2">
              <input
                id={`${uid}-cur`}
                className="input w-28"
                value={currency}
                maxLength={4}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  saveCurrency(e.target.value);
                }}
                aria-invalid={!!error}
                aria-describedby={`${uid}-cur-hint`}
              />
              <p id={`${uid}-cur-hint`} className="self-center text-sm text-zinc-500 dark:text-zinc-400">
                Preview: {formatMoney(125050, state.settings.currency)}
              </p>
            </div>
            {error && <p className="field-error">{error}</p>}
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Common currencies">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={state.settings.currency === c}
                  className={`chip min-w-11 justify-center ${
                    state.settings.currency === c ? 'border-zinc-900 bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : ''
                  }`}
                  onClick={() => {
                    setCurrency(c);
                    saveCurrency(c);
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Only the symbol changes. Amounts are not converted.
            </p>
          </div>

          <div role="radiogroup" aria-labelledby={`${uid}-theme`}>
            <p id={`${uid}-theme`} className="label">
              Appearance
            </p>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={state.settings.theme === value}
                  onClick={() => dispatch({ type: 'UPDATE_SETTINGS', patch: { theme: value } })}
                  className={`btn border ${
                    state.settings.theme === value
                      ? 'border-zinc-900 bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                      : 'border-zinc-300 dark:border-zinc-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {cloud.enabled && (
            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <p className="label">Account</p>
              {cloud.status === 'signed-in' ? (
                <div className="flex items-center gap-3">
                  {cloud.user.photo ? (
                    <img src={cloud.user.photo} alt="" referrerPolicy="no-referrer" className="size-10 rounded-full" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{cloud.user.name || cloud.user.email}</p>
                    <p className="truncate text-[13px] text-zinc-500 dark:text-zinc-400">{cloud.user.email} · trips sync to your account</p>
                  </div>
                  <button type="button" className="btn-secondary h-10" onClick={cloud.signOut}>
                    Sign out
                  </button>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
                    Sign in to back up your trips and share them with friends, so everyone can add expenses from their own phone.
                  </p>
                  <GoogleButton />
                </>
              )}
            </div>
          )}

          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="label">Data</p>
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
              {cloud.status === 'signed-in'
                ? 'Your trips are saved to your Google account and kept on this device for offline use. Bill photos stay on the device that added them.'
                : 'Everything is stored only in this browser. Clearing site data or switching devices will lose it, so sign in or export a CSV first.'}
            </p>
            <button type="button" className="btn-ghost text-red-600 dark:text-red-400" onClick={() => setConfirmReset(true)}>
              Erase all trips
            </button>
          </div>
        </div>
      </Modal>
      {confirmReset && (
        <ConfirmDialog
          title="Erase all trips?"
          message={
            cloud.status === 'signed-in'
              ? `This permanently deletes the trips you own (for everyone they’re shared with) and removes you from trips others shared with you. ${state.trips.length} trip(s) in total.`
              : `This permanently deletes all ${state.trips.length} trip(s), people and expenses stored on this device.`
          }
          confirmLabel="Erase everything"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            dispatch({ type: 'RESET' });
            clearReceipts().catch(() => {});
            toast('All data erased');
            setConfirmReset(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
