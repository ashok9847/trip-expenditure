import { useEffect, useId, useMemo, useState } from 'react';
import { useAppState } from '../../hooks/useAppState.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { computeBalances, totalExpenditure } from '../../utils/balances.js';
import { EXACT_LIMIT, settleUp } from '../../utils/settlement.js';
import { formatMoney } from '../../utils/money.js';
import { buildLogCsv, buildShareText, buildSummaryCsv } from '../../utils/export.js';
import { copyText, downloadFile, slugify } from '../../utils/download.js';
import { settleKey } from '../../utils/copy.js';
import EmptyState from '../ui/EmptyState.jsx';
import Avatar from '../ui/Avatar.jsx';
import PayModal from './PayModal.jsx';
import { ArrowRightIcon, ChevronRightIcon, CopyIcon, DownloadIcon, QrIcon, ScaleIcon, ShareIcon } from '../ui/Icons.jsx';

function Stat({ label, value }) {
  return (
    <div className="px-4 py-3.5">
      <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="num mt-0.5 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function ActionRow({ icon: Icon, title, subtitle, onClick, href, disabled }) {
  const cls =
    'list-row transition-colors hover:bg-zinc-50 active:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800/50 dark:active:bg-zinc-800';
  const content = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="block truncate text-[13px] text-zinc-500 dark:text-zinc-400">{subtitle}</span>
      </span>
      <ChevronRightIcon className="size-4 shrink-0 text-zinc-400" />
    </>
  );
  return href ? (
    <a className={cls} href={href} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  ) : (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {content}
    </button>
  );
}

export default function SummaryTab({ trip, onGoToPeople }) {
  const { currency, dispatch } = useAppState();
  const toast = useToast();
  const uid = useId();
  const [includeLog, setIncludeLog] = useState(false);
  const [payingKey, setPayingKey] = useState(null); // settleKey of the payment open in PayModal
  const money = (v) => formatMoney(v, currency);

  // Balances and settlements depend on participants and expenses only, so a paid
  // mark (trip.settled) can never change them (R12.17).
  const { participants, expenses } = trip;
  const { balances, settlements, total } = useMemo(() => {
    const balances = computeBalances(participants, expenses);
    return { balances, settlements: settleUp(balances), total: totalExpenditure(expenses) };
  }, [participants, expenses]);
  const nameOf = (id) => trip.participants.find((p) => p.id === id)?.name ?? 'Unknown';

  const settled = trip.settled ?? {};
  const isPaid = (s) => Boolean(settled[settleKey(s)]);

  // Drop paid marks whose payment no longer exists after a recalculation (R12.16).
  useEffect(() => {
    const live = new Set(settlements.map(settleKey));
    if (Object.keys(trip.settled ?? {}).some((k) => !live.has(k))) {
      dispatch({ type: 'PRUNE_SETTLED', tripId: trip.id, settlements });
    }
  }, [settlements, trip.settled, trip.id, dispatch]);

  const paying = payingKey ? settlements.find((s) => settleKey(s) === payingKey) : null;

  if (trip.participants.length === 0) {
    return (
      <EmptyState
        icon={ScaleIcon}
        title="Nothing to balance yet"
        action={
          <button type="button" className="btn-primary" onClick={onGoToPeople}>
            Add people
          </button>
        }
      >
        Add people and expenses to see who spent what and who owes whom.
      </EmptyState>
    );
  }

  const shareText = () => buildShareText(trip, balances, settlements, total, currency, { includeLog });
  const file = slugify(trip.name);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const nonZero = balances.filter((b) => b.net !== 0).length;
  const ordered = [...balances].sort((a, b) => b.net - a.net);

  const onCopy = async () => toast((await copyText(shareText())) ? 'Summary copied' : 'Could not copy', 'default');
  const onShare = async () => {
    try {
      await navigator.share({ title: `TripSplit – ${trip.name}`, text: shareText() });
    } catch (e) {
      if (e?.name !== 'AbortError') toast('Sharing failed', 'error');
    }
  };

  return (
    <div className="space-y-7">
      <div className="card grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800">
        <Stat label="Total spent" value={money(total)} />
        <Stat label="Per person" value={money(Math.round(total / trip.participants.length))} />
        <Stat label="Expenses" value={trip.expenses.length} />
      </div>

      {/* Settle up */}
      <section aria-labelledby={`${uid}-settle`}>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 id={`${uid}-settle`} className="text-[15px] font-semibold tracking-tight">
            Settle up
          </h2>
          {settlements.length > 0 && (
            <span className="text-[13px] text-zinc-500">
              {settlements.length} payment{settlements.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {settlements.length === 0 ? (
          <p className="card p-5 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {trip.expenses.length === 0 ? 'Add expenses to see who owes whom.' : 'Everyone is settled up.'}
          </p>
        ) : (
          <>
            <ul className="card divide-y divide-zinc-100 dark:divide-zinc-800">
              {settlements.map((s) => {
                const key = settleKey(s);
                const paid = isPaid(s);
                return (
                  <li key={key} className="list-row">
                    <span className={`flex min-w-0 flex-1 items-center gap-3 ${paid ? 'opacity-60' : ''}`}>
                      <span className="flex shrink-0 items-center">
                        <Avatar trip={trip} id={s.from} name={nameOf(s.from)} size="sm" ring />
                        <ArrowRightIcon className="mx-1 size-3.5 text-zinc-400" />
                        <Avatar trip={trip} id={s.to} name={nameOf(s.to)} size="sm" ring />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[15px]">
                        <span className="font-medium">{nameOf(s.from)}</span>
                        <span className="text-zinc-500 dark:text-zinc-400"> pays </span>
                        <span className="font-medium">{nameOf(s.to)}</span>
                        {paid && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 align-middle text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Paid
                          </span>
                        )}
                      </span>
                      <span className={`num shrink-0 text-[15px] font-semibold ${paid ? 'line-through' : ''}`}>
                        {money(s.amount)}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="btn-secondary min-h-11 min-w-11 shrink-0 gap-1.5 px-3"
                      aria-label={`Pay ${nameOf(s.to)} ${money(s.amount)}`}
                      onClick={() => setPayingKey(key)}
                    >
                      <QrIcon className="size-4" />
                      Pay
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 px-1 text-xs text-zinc-500 dark:text-zinc-400">
              {nonZero <= EXACT_LIMIT ? 'The fewest payments that clear every balance.' : 'Payments that clear every balance.'}
            </p>
          </>
        )}
      </section>

      {/* Balances */}
      <section aria-labelledby={`${uid}-bal`}>
        <h2 id={`${uid}-bal`} className="mb-2 px-1 text-[15px] font-semibold tracking-tight">
          Balances
        </h2>
        <div className="card overflow-hidden">
          <table className="w-full table-fixed text-left">
            <caption className="sr-only">Paid, share and net balance for each person</caption>
            <thead>
              <tr className="border-b border-zinc-100 text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
                <th scope="col" className="py-2.5 pl-4 font-medium">Person</th>
                <th scope="col" className="w-[22%] py-2.5 text-right font-medium">Paid</th>
                <th scope="col" className="w-[22%] py-2.5 text-right font-medium">Share</th>
                <th scope="col" className="w-[25%] py-2.5 pr-4 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {ordered.map((b) => (
                <tr key={b.id}>
                  <th scope="row" className="py-3 pl-4 font-normal">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar trip={trip} id={b.id} name={b.name} size="sm" />
                      <span className="truncate text-[15px] font-medium">{b.name}</span>
                    </span>
                  </th>
                  <td className="num py-3 text-right text-[13px] text-zinc-600 dark:text-zinc-300">{money(b.paid)}</td>
                  <td className="num py-3 text-right text-[13px] text-zinc-600 dark:text-zinc-300">{money(b.share)}</td>
                  <td className={`num py-3 pr-4 text-right text-[15px] font-semibold ${b.net > 0 ? 'pos' : b.net < 0 ? 'neg' : 'text-zinc-400'}`}>
                    {b.net > 0 ? '+' : b.net < 0 ? '−' : ''}
                    {money(Math.abs(b.net))}
                    <span className="sr-only">{b.net > 0 ? ' gets back' : b.net < 0 ? ' owes' : ' settled'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-200 bg-zinc-50 text-[13px] dark:border-zinc-800 dark:bg-zinc-900/60">
                <th scope="row" className="py-2.5 pl-4 font-medium text-zinc-500 dark:text-zinc-400">Total</th>
                <td className="num py-2.5 text-right font-medium">{money(total)}</td>
                <td className="num py-2.5 text-right font-medium">{money(total)}</td>
                <td className="py-2.5 pr-4" />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 px-1 text-xs text-zinc-500 dark:text-zinc-400">
          Net is what each person paid minus their share. <span className="pos">+</span> gets money back,{' '}
          <span className="neg">−</span> owes.
        </p>
      </section>

      {/* Export */}
      <section aria-labelledby={`${uid}-export`}>
        <h2 id={`${uid}-export`} className="mb-2 px-1 text-[15px] font-semibold tracking-tight">
          Share & export
        </h2>
        <div className="card divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
          <label className="list-row cursor-pointer">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">Include expense list</span>
              <span className="block text-[13px] text-zinc-500 dark:text-zinc-400">Adds every expense to the shared text</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="peer sr-only"
              checked={includeLog}
              onChange={(e) => setIncludeLog(e.target.checked)}
            />
            <span
              aria-hidden="true"
              className="relative h-6 w-10 shrink-0 rounded-full bg-zinc-200 transition-colors peer-checked:bg-zinc-900 peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-400 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4 dark:bg-zinc-700 dark:peer-checked:bg-zinc-100 dark:after:bg-zinc-900 dark:peer-checked:after:bg-zinc-900"
            />
          </label>
          <ActionRow icon={CopyIcon} title="Copy summary" subtitle="Paste into WhatsApp or any chat" onClick={onCopy} />
          {canShare ? (
            <ActionRow icon={ShareIcon} title="Share" subtitle="Send using another app" onClick={onShare} />
          ) : (
            <ActionRow
              icon={ShareIcon}
              title="Send on WhatsApp"
              subtitle="Opens WhatsApp with the summary"
              href={`https://wa.me/?text=${encodeURIComponent(shareText())}`}
            />
          )}
          <ActionRow
            icon={DownloadIcon}
            title="Summary (CSV)"
            subtitle="Balances and settle-up plan"
            onClick={() => downloadFile(`${file}-summary.csv`, buildSummaryCsv(trip, balances, settlements, total))}
          />
          <ActionRow
            icon={DownloadIcon}
            title="Expenses (CSV)"
            subtitle="Every expense with its split"
            disabled={trip.expenses.length === 0}
            onClick={() => downloadFile(`${file}-expenses.csv`, buildLogCsv(trip))}
          />
        </div>
      </section>

      {paying && (
        <PayModal
          trip={trip}
          payment={paying}
          currency={currency}
          paid={isPaid(paying)}
          onToggle={() => dispatch({ type: 'TOGGLE_SETTLED', tripId: trip.id, key: settleKey(paying) })}
          onClose={() => setPayingKey(null)}
        />
      )}
    </div>
  );
}
