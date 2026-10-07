import { useEffect, useId, useMemo, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Avatar from '../ui/Avatar.jsx';
import { StickerBadge } from '../trail/Stickers.jsx';
import { useSticker } from '../../hooks/useStickers.js';
import BillField from '../bills/BillField.jsx';
import BillViewer from '../bills/BillViewer.jsx';
import { useReceiptUrl } from '../../hooks/useReceiptUrl.js';
import { deleteReceipt, saveReceipt } from '../../storage/receipts.js';
import { prepareBillFile, validateBillFile } from '../../utils/image.js';
import { createId } from '../../utils/id.js';
import { useAppState } from '../../hooks/useAppState.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { formatMoney, parseAmount, toMajorString } from '../../utils/money.js';
import { describeEqualSplit, equalSplit, validateCustomSplit } from '../../utils/splits.js';
import { fromLocalInputValue, toLocalInputValue } from '../../utils/dates.js';

const QUICK_DESCRIPTIONS = ['Food', 'Cab', 'Hotel', 'Drinks', 'Snacks', 'Tickets', 'Fuel', 'Groceries'];
const MAX_DESCRIPTION = 60;
const MAX_CATEGORY = 30;
const QUICK_CATEGORIES = ['Food', 'Travel', 'Stay', 'Activities', 'Shopping', 'Drinks', 'Groceries', 'Other'];

/** Parse a custom-share input: blank counts as 0, invalid is null. */
const parseShare = (str) => (str.trim() === '' ? 0 : parseAmount(str));

export default function ExpenseForm({ trip, expense = null, onClose }) {
  const { dispatch, currency } = useAppState();
  const toast = useToast();
  const uid = useId();
  const fid = (name) => `${uid}-${name}`;
  const isEdit = !!expense;
  const people = trip.participants;

  const initialDate = toLocalInputValue(expense ? expense.dateTime : new Date());
  const [amountStr, setAmountStr] = useState(expense ? toMajorString(expense.amount) : '');
  const [description, setDescription] = useState(expense?.description ?? '');
  const [category, setCategory] = useState(expense?.category ?? '');
  const [paidBy, setPaidBy] = useState(() => {
    if (expense) return expense.paidBy;
    const last = people.find((p) => p.id === trip.lastPayerId);
    return (last ?? people[0])?.id ?? '';
  });
  const [dateLocal, setDateLocal] = useState(initialDate);
  const [selected, setSelected] = useState(() => new Set(expense ? expense.participantIds : people.map((p) => p.id)));
  const [splitMode, setSplitMode] = useState(expense?.splitMode ?? 'equal');
  const [customStrs, setCustomStrs] = useState(() =>
    expense?.splitMode === 'custom'
      ? Object.fromEntries(Object.entries(expense.customShares).map(([id, v]) => [id, toMajorString(v)]))
      : {},
  );
  const [showErrors, setShowErrors] = useState(false);
  const liveSticker = useSticker(description);

  // ---- bill / receipt ----------------------------------------------------
  const [keepExistingBill, setKeepExistingBill] = useState(!!expense?.receiptId);
  const [newBill, setNewBill] = useState(null); // Blob picked in this session
  const [newBillUrl, setNewBillUrl] = useState(null);
  const [billBusy, setBillBusy] = useState(false);
  const [billError, setBillError] = useState(null);
  const [viewingBill, setViewingBill] = useState(false);
  const [saving, setSaving] = useState(false);
  const existingBill = useReceiptUrl(keepExistingBill ? expense?.receiptId : null);

  useEffect(() => {
    if (!newBill) return setNewBillUrl(null);
    const url = URL.createObjectURL(newBill);
    setNewBillUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [newBill]);

  const billUrl = newBill ? newBillUrl : existingBill.url;
  const billType = newBill ? newBill.type : existingBill.type;

  const pickBill = async (file) => {
    const problem = validateBillFile(file);
    if (problem) return setBillError(problem);
    setBillError(null);
    setBillBusy(true);
    try {
      setNewBill(await prepareBillFile(file));
      setKeepExistingBill(false);
    } catch (e) {
      setBillError(e.message || 'Could not read that file.');
    } finally {
      setBillBusy(false);
    }
  };

  const removeBill = () => {
    setNewBill(null);
    setKeepExistingBill(false);
    setBillError(null);
  };

  const amount = parseAmount(amountStr);
  const selectedIds = people.filter((p) => selected.has(p.id)).map((p) => p.id);
  const allSelected = selectedIds.length === people.length;
  const validAmount = amount !== null && amount > 0;

  const equalShares = validAmount ? equalSplit(amount, selectedIds) : {};
  const customParsed = Object.fromEntries(people.map((p) => [p.id, parseShare(customStrs[p.id] ?? '')]));
  const customCheck = validateCustomSplit(validAmount ? amount : 0, customParsed, selectedIds);

  const recentDescriptions = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const e of [...trip.expenses].reverse()) {
      const key = e.description.toLocaleLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push(e.description);
      }
    }
    for (const d of QUICK_DESCRIPTIONS) if (!seen.has(d.toLocaleLowerCase())) list.push(d);
    return list.slice(0, 8);
  }, [trip.expenses]);

  // Categories already used on this trip first, then the defaults.
  const categoryOptions = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const c of [...trip.expenses].reverse().map((e) => e.category).filter(Boolean).concat(QUICK_CATEGORIES)) {
      const key = c.toLocaleLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push(c);
      }
    }
    return list;
  }, [trip.expenses]);

  // ---- validation --------------------------------------------------------
  const errors = {};
  if (amountStr.trim() === '') errors.amount = 'Enter an amount.';
  else if (amount === null) errors.amount = 'Enter a valid amount, like 250 or 99.50.';
  else if (amount === 0) errors.amount = 'Amount must be more than zero.';
  if (!description.trim()) errors.description = 'What was this for? e.g. Noodles, Cab to hotel.';
  if (!people.some((p) => p.id === paidBy)) errors.paidBy = 'Choose who paid.';
  if (!fromLocalInputValue(dateLocal)) errors.dateTime = 'Pick a valid date and time.';
  if (selectedIds.length === 0) errors.split = 'Select at least one person to split with.';
  else if (splitMode === 'custom' && validAmount && !customCheck.valid) {
    const diff = customCheck.difference;
    errors.split =
      diff > 0 && Number.isFinite(diff)
        ? `${customCheck.error} ${formatMoney(diff, currency)} still to assign.`
        : diff < 0
          ? `${customCheck.error} Over by ${formatMoney(-diff, currency)}.`
          : customCheck.error;
  }
  const hasErrors = Object.keys(errors).length > 0;
  const err = (key) => (showErrors ? errors[key] : undefined);

  // ---- handlers ----------------------------------------------------------
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(people.map((p) => p.id)));

  const fillEqually = () => {
    if (!validAmount || selectedIds.length === 0) return;
    const shares = equalSplit(amount, selectedIds);
    setCustomStrs(Object.fromEntries(selectedIds.map((id) => [id, toMajorString(shares[id])])));
  };

  const switchMode = (mode) => {
    setSplitMode(mode);
    // Start custom mode from the equal split so the user only tweaks the differences.
    const hasCustomValues = selectedIds.some((id) => (customStrs[id] ?? '').trim() !== '');
    if (mode === 'custom' && !hasCustomValues) fillEqually();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving || billBusy) return;
    if (hasErrors) {
      setShowErrors(true);
      const order = ['amount', 'description', 'paidBy', 'split', 'dateTime'];
      const first = order.find((k) => errors[k]);
      document.getElementById(fid(first))?.focus();
      return;
    }
    // Store the bill file first so the expense never points at a missing file.
    const oldReceiptId = expense?.receiptId ?? null;
    let receiptId = keepExistingBill ? oldReceiptId : null;
    if (newBill) {
      setSaving(true);
      try {
        receiptId = createId();
        await saveReceipt(receiptId, newBill);
      } catch {
        setSaving(false);
        setBillError('Couldn’t save the bill on this device (storage may be full). Remove it or try again.');
        return;
      }
    }
    if (oldReceiptId && oldReceiptId !== receiptId) deleteReceipt(oldReceiptId).catch(() => {});

    const payload = {
      id: expense?.id,
      receiptId,
      description: description.trim(),
      category: category.trim() || null,
      amount,
      paidBy,
      // Keep the original timestamp (incl. seconds) if the user didn't touch the date.
      dateTime: isEdit && dateLocal === initialDate ? expense.dateTime : fromLocalInputValue(dateLocal),
      splitMode,
      participantIds: selectedIds,
      customShares:
        splitMode === 'custom' ? Object.fromEntries(selectedIds.map((id) => [id, customParsed[id]])) : null,
    };
    dispatch({ type: isEdit ? 'UPDATE_EXPENSE' : 'ADD_EXPENSE', tripId: trip.id, expense: payload });
    toast(isEdit ? 'Expense updated' : `${formatMoney(amount, currency)} for ${payload.description} added`);
    onClose();
  };

  // ---- preview text ------------------------------------------------------
  let preview;
  const n = selectedIds.length;
  if (n === 0) preview = 'Nobody selected yet';
  else if (splitMode === 'custom') {
    preview = validAmount
      ? `Assigned ${formatMoney(customCheck.sum, currency)} of ${formatMoney(amount, currency)}`
      : 'Enter the total amount first';
  } else if (!validAmount) {
    preview = `Split among ${n} ${n === 1 ? 'person' : 'people'}`;
  } else {
    const { base, extraCount } = describeEqualSplit(amount, n);
    preview = `Split among ${n} ${n === 1 ? 'person' : 'people'}, ${formatMoney(base, currency)} each`;
    if (extraCount > 0) {
      const names = selectedIds.slice(0, extraCount).map((id) => people.find((p) => p.id === id).name);
      const who = extraCount <= 2 ? names.join(' & ') : `${extraCount} people`;
      preview += ` (${who} ${extraCount === 1 ? 'pays' : 'pay'} ${formatMoney(base + 1, currency)} to cover rounding)`;
    }
  }
  const customOk = splitMode === 'custom' && validAmount && n > 0 && customCheck.valid;

  return (
    <Modal
      title={isEdit ? 'Edit expense' : 'Add expense'}
      onClose={onClose}
      footer={
        <button
          type="submit"
          form={fid('form')}
          className="btn-primary h-12 w-full"
          disabled={saving || billBusy}
        >
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add expense'}
        </button>
      }
    >
      <form id={fid('form')} onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Amount: large, centred, payment-app style */}
        <div className="pt-1 pb-2 text-center">
          <label htmlFor={fid('amount')} className="eyebrow">
            Amount
          </label>
          <div className="mt-1 flex items-baseline justify-center gap-1">
            <span className="text-[28px] font-medium text-zinc-400" aria-hidden="true">
              {currency}
            </span>
            <input
              id={fid('amount')}
              className={`num w-[8ch] max-w-full bg-transparent text-center text-[44px] leading-tight font-semibold tracking-tight placeholder:text-zinc-300 focus:outline-none dark:placeholder:text-zinc-700 ${
                err('amount') ? 'text-red-600' : ''
              }`}
              style={{ width: `${Math.max(2, amountStr.length || 1) + 0.5}ch` }}
              inputMode="decimal"
              enterKeyHint="next"
              autoComplete="off"
              placeholder="0"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              autoFocus={!isEdit}
              aria-invalid={!!err('amount')}
              aria-describedby={err('amount') ? fid('amount-err') : undefined}
            />
          </div>
          {err('amount') && (
            <p id={fid('amount-err')} className="field-error">
              {err('amount')}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor={fid('description')} className="label">
            What was it for?
          </label>
          <div className="flex items-center gap-2">
            <input
              id={fid('description')}
              className="input flex-1"
              placeholder="e.g. Noodles, Cab to hotel"
              maxLength={MAX_DESCRIPTION}
              autoComplete="off"
              autoCapitalize="sentences"
              enterKeyHint="done"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-invalid={!!err('description')}
              aria-describedby={err('description') ? fid('description-err') : undefined}
            />
            {/* live trail-map sticker for this title */}
            <span className="shrink-0 transition-transform" style={{ transform: `rotate(${description.length % 2 ? 4 : -4}deg)` }}>
              <StickerBadge sticker={liveSticker} size={48} title={description} />
            </span>
          </div>
          {err('description') && (
            <p id={fid('description-err')} className="field-error">
              {err('description')}
            </p>
          )}
          <div className="-mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 pb-1" role="group" aria-label="Quick descriptions">
            {recentDescriptions.map((d) => (
              <button
                key={d}
                type="button"
                className="chip"
                aria-pressed={description === d}
                onClick={() => setDescription(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Category (free text, optional) */}
        <div>
          <label htmlFor={fid('category')} className="label">
            Category <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            id={fid('category')}
            className="input"
            placeholder="e.g. Food, Travel, Stay, Shopping"
            maxLength={MAX_CATEGORY}
            autoComplete="off"
            autoCapitalize="sentences"
            enterKeyHint="done"
            list={fid('category-list')}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id={fid('category-list')}>
            {categoryOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="-mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 pb-1" role="group" aria-label="Quick categories">
            {categoryOptions.slice(0, 8).map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={category === c} onClick={() => setCategory(category === c ? '' : c)}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Paid by */}
        <div>
          <label htmlFor={fid('paidBy')} className="label">
            Paid by
          </label>
          <select
            id={fid('paidBy')}
            className="input appearance-auto"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            aria-invalid={!!err('paidBy')}
          >
            {!paidBy && <option value="">Choose who paid</option>}
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {err('paidBy') && <p className="field-error">{err('paidBy')}</p>}
        </div>

        {/* Split */}
        <div
          role="group"
          aria-labelledby={fid('split-label')}
          aria-describedby={`${fid('preview')}${err('split') ? ` ${fid('split-err')}` : ''}`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span id={fid('split-label')} className="label mb-0">
              Split between{' '}
              <span className="font-normal text-zinc-400">
                · {selectedIds.length} of {people.length}
              </span>
            </span>
            <div role="radiogroup" aria-label="Split mode" className="segmented">
              {[
                ['equal', 'Equal'],
                ['custom', 'Custom'],
              ].map(([mode, label]) => (
                <button key={mode} type="button" role="radio" aria-checked={splitMode === mode} onClick={() => switchMode(mode)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`overflow-hidden rounded-xl border ${
              err('split') ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-800'
            }`}
          >
            <button
              id={fid('split')}
              type="button"
              onClick={toggleAll}
              className="flex h-12 w-full items-center gap-3 border-b border-zinc-100 bg-zinc-50 px-4 text-left text-sm font-medium hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:bg-zinc-800"
            >
              <span
                aria-hidden="true"
                className={`flex size-[22px] items-center justify-center rounded-[5px] border-[1.5px] text-xs font-bold ${
                  selectedIds.length > 0
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                    : 'border-zinc-300 dark:border-zinc-600'
                }`}
              >
                {allSelected ? '✓' : selectedIds.length > 0 ? '–' : ''}
              </span>
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>

            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {people.map((p) => {
                const checked = selected.has(p.id);
                const customInvalid = splitMode === 'custom' && checked && customParsed[p.id] === null;
                return (
                  <li key={p.id} className="flex items-center gap-2 pr-3">
                    <label className="flex min-h-14 flex-1 cursor-pointer items-center gap-3 pl-4 select-none">
                      <input
                        type="checkbox"
                        className="size-[22px] shrink-0 cursor-pointer"
                        checked={checked}
                        onChange={() => toggle(p.id)}
                      />
                      <Avatar trip={trip} id={p.id} name={p.name} size="sm" className={checked ? '' : 'opacity-40'} />
                      <span className={`truncate text-[15px] ${checked ? '' : 'text-zinc-400 dark:text-zinc-500'}`}>
                        {p.name}
                        {p.id === paidBy && <span className="ml-1.5 text-xs text-zinc-400">paid</span>}
                      </span>
                    </label>
                    {splitMode === 'equal' ? (
                      <span className="num text-sm text-zinc-500 dark:text-zinc-400">
                        {checked && validAmount ? formatMoney(equalShares[p.id], currency) : '–'}
                      </span>
                    ) : (
                      <div className="relative w-28">
                        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-zinc-400">
                          {currency}
                        </span>
                        <input
                          className="input num h-10 pr-2.5 text-right text-[15px]"
                          style={{ paddingLeft: `${0.9 + currency.length * 0.6}rem` }}
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0"
                          disabled={!checked}
                          value={checked ? customStrs[p.id] ?? '' : ''}
                          onChange={(e) => setCustomStrs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          aria-label={`${p.name}'s share`}
                          aria-invalid={customInvalid}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p
              id={fid('preview')}
              aria-live="polite"
              className={`text-[13px] ${customOk ? 'pos font-medium' : 'text-zinc-500 dark:text-zinc-400'}`}
            >
              {preview}
              {customOk && ' · balanced'}
            </p>
            {splitMode === 'custom' && (
              <button type="button" className="chip" onClick={fillEqually} disabled={!validAmount || n === 0}>
                Reset to equal
              </button>
            )}
          </div>
          {err('split') && (
            <p id={fid('split-err')} className="field-error" role="alert">
              {err('split')}
            </p>
          )}
        </div>

        {/* Bill / receipt */}
        <BillField
          previewUrl={billUrl}
          previewType={billType}
          loading={!newBill && keepExistingBill && existingBill.status === 'loading'}
          busy={billBusy}
          error={billError}
          onPick={pickBill}
          onRemove={removeBill}
          onView={() => setViewingBill(true)}
        />

        {/* Date & time */}
        <div>
          <label htmlFor={fid('dateTime')} className="label">
            Date & time
          </label>
          <div className="flex gap-2">
            <input
              id={fid('dateTime')}
              type="datetime-local"
              className="input"
              value={dateLocal}
              onChange={(e) => setDateLocal(e.target.value)}
              aria-invalid={!!err('dateTime')}
            />
            <button type="button" className="btn-secondary shrink-0" onClick={() => setDateLocal(toLocalInputValue(new Date()))}>
              Now
            </button>
          </div>
          {err('dateTime') && <p className="field-error">{err('dateTime')}</p>}
        </div>
      </form>
      {viewingBill && billUrl && (
        <BillViewer
          url={billUrl}
          type={billType}
          title={description.trim() || 'Expense'}
          onClose={() => setViewingBill(false)}
        />
      )}
    </Modal>
  );
}
