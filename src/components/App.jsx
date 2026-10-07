import { useEffect, useRef, useState } from 'react';
import { useAppState } from '../hooks/useAppState.jsx';
import { pruneOrphanReceipts } from '../storage/receipts.js';
import { useTheme } from '../hooks/useTheme.js';
import { useToast } from '../hooks/useToast.jsx';
import { formatDateRange } from '../utils/dates.js';
import ExpenseForm from './expenses/ExpenseForm.jsx';
import ExpenseLog from './expenses/ExpenseLog.jsx';
import SummaryTab from './summary/SummaryTab.jsx';
import PeopleTab from './people/PeopleTab.jsx';
import TripsModal from './trips/TripsModal.jsx';
import TripForm from './trips/TripForm.jsx';
import SettingsModal from './settings/SettingsModal.jsx';
import JourneyTab from './journey/JourneyTab.jsx';
import Logo from './ui/Logo.jsx';
import GoogleButton from './cloud/GoogleButton.jsx';
import { makeDemoTrip } from '../utils/demoTrip.js';
import {
  ChevronDownIcon,
  MindMapIcon,
  MoonIcon,
  PlusIcon,
  ReceiptIcon,
  ScaleIcon,
  SettingsIcon,
  SunIcon,
  UsersIcon,
} from './ui/Icons.jsx';

const TABS = [
  { id: 'expenses', label: 'Expenses', title: 'Expenses', icon: ReceiptIcon },
  { id: 'summary', label: 'Balances', title: 'Balances', icon: ScaleIcon },
  { id: 'map', label: 'Journey', title: 'Journey', icon: MindMapIcon },
  { id: 'people', label: 'People', title: 'People', icon: UsersIcon },
];

function Header({ trip, isDark, onToggleTheme, onOpenTrips, onOpenSettings }) {
  const range = trip ? formatDateRange(trip.startDate, trip.endDate) : '';
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-zinc-50/85 pt-[env(safe-area-inset-top)] backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/85">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-1 px-3">
        {trip ? (
          <button
            type="button"
            onClick={onOpenTrips}
            className="-ml-1 flex h-11 min-w-0 items-center gap-2.5 rounded-lg px-2 text-left transition-colors hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60"
            aria-label={`Current trip: ${trip.name}. Switch or manage trips`}
          >
            <Logo className="size-7 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-[15px] leading-tight font-semibold tracking-tight">{trip.name}</span>
              <span className="block truncate text-xs leading-tight text-zinc-500 dark:text-zinc-400">
                {range || `${trip.participants.length} ${trip.participants.length === 1 ? 'person' : 'people'}`}
              </span>
            </span>
            <ChevronDownIcon className="size-4 shrink-0 text-zinc-400" />
          </button>
        ) : (
          <span className="flex items-center gap-2.5 px-1">
            <Logo className="size-7" />
            <span className="text-[15px] font-semibold tracking-tight">TripSplit</span>
          </span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <SunIcon className="size-[18px]" /> : <MoonIcon className="size-[18px]" />}
        </button>
        <button type="button" className="icon-btn" onClick={onOpenSettings} aria-label="Settings">
          <SettingsIcon className="size-[18px]" />
        </button>
      </div>
    </header>
  );
}

const FEATURES = [
  { icon: ReceiptIcon, title: 'Log in seconds', text: 'Amount, who paid, who shared. Done.' },
  { icon: ScaleIcon, title: 'Always balanced', text: 'Exact to the paisa, no rounding gaps.' },
  { icon: UsersIcon, title: 'Fewest payments', text: 'Settle the whole trip with minimal transfers.' },
];

function Welcome({ onCreate, onDemo }) {
  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-16">
      <Logo className="size-12" />
      <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-tight">
        Shared trip expenses,
        <br />
        settled simply.
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Track who paid for what and see exactly who owes whom. No account needed. Your data stays on this device.
      </p>

      <ul className="mt-8 space-y-4">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <Icon className="size-[18px]" />
            </span>
            <span>
              <span className="block text-sm font-medium">{title}</span>
              <span className="block text-sm text-zinc-500 dark:text-zinc-400">{text}</span>
            </span>
          </li>
        ))}
      </ul>

      <section className="card mt-10 p-5" aria-labelledby="first-trip">
        <h2 id="first-trip" className="text-base font-semibold tracking-tight">
          Create your first trip
        </h2>
        <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">You can add people and expenses next.</p>
        <TripForm onSubmit={onCreate} autoFocus={false} submitLabel="Create trip" />
      </section>
      <GoogleButton className="mt-3" label="Sign in with Google to see shared trips" />
      <button type="button" className="btn-ghost mt-3 w-full" onClick={onDemo}>
        Or explore a demo trip (6 friends in Goa)
      </button>
    </main>
  );
}

export default function App() {
  const { state, dispatch, activeTrip } = useAppState();
  const toast = useToast();
  const isDark = useTheme(state.settings.theme);
  const [tab, setTab] = useState('expenses');
  const [modal, setModal] = useState(null); // { type: 'expense'|'trips'|'settings', ... }
  const [logFilters, setLogFilters] = useState({ person: '', date: '' });

  // Once per load: delete stored bill files no expense points to any more.
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    pruneOrphanReceipts(stateRef.current).catch(() => {});
  }, []);

  // Tell the user when the browser refused to save (storage full), instead of losing data silently.
  useEffect(() => {
    const onFail = () => toast('Couldn’t save on this device: storage is full. Sign in to keep your trips in the cloud.', 'error');
    window.addEventListener('tripsplit:save-failed', onFail);
    return () => window.removeEventListener('tripsplit:save-failed', onFail);
  }, [toast]);

  const tripId = activeTrip?.id;
  const hasPeople = (activeTrip?.participants.length ?? 0) > 0;

  // When switching to a trip with nobody on it, guide the user to add people.
  useEffect(() => {
    setLogFilters({ person: '', date: '' });
    if (tripId && !hasPeople) setTab('people');
  }, [tripId]); // intentionally only on trip change

  const selectTab = (id) => {
    setTab(id);
    window.scrollTo({ top: 0 });
  };
  const openAddExpense = () => {
    if (!hasPeople) {
      selectTab('people');
      toast('Add the people on this trip first');
      return;
    }
    setModal({ type: 'expense', expense: null });
  };
  const closeModal = () => setModal(null);
  const toggleTheme = () => dispatch({ type: 'UPDATE_SETTINGS', patch: { theme: isDark ? 'light' : 'dark' } });
  const current = TABS.find((t) => t.id === tab);

  return (
    <div className="min-h-dvh">
      <Header
        trip={activeTrip}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenTrips={() => setModal({ type: 'trips' })}
        onOpenSettings={() => setModal({ type: 'settings' })}
      />

      {!activeTrip ? (
        <Welcome
          onCreate={(v) => {
            dispatch({ type: 'ADD_TRIP', ...v });
            toast(`“${v.name}” created. Add the people travelling.`);
          }}
          onDemo={() => {
            dispatch({ type: 'IMPORT_TRIP', trip: makeDemoTrip() });
            setTab('map');
            toast('Demo trip loaded. Hit “Play trip”.');
          }}
        />
      ) : (
        <>
          <main className="mx-auto max-w-2xl px-4 pt-5 pb-40">
            <h1 className={tab === 'map' ? 'sr-only' : 'mb-4 text-[26px] font-semibold tracking-tight'}>{current.title}</h1>
            {tab === 'expenses' && (
              <ExpenseLog
                trip={activeTrip}
                filters={logFilters}
                onFiltersChange={setLogFilters}
                onEdit={(expense) => setModal({ type: 'expense', expense })}
                onGoToPeople={() => selectTab('people')}
                onAdd={openAddExpense}
              />
            )}
            {tab === 'summary' && <SummaryTab trip={activeTrip} onGoToPeople={() => selectTab('people')} />}
            {tab === 'map' && (
              <JourneyTab trip={activeTrip} isDark={isDark} onGoToPeople={() => selectTab('people')} onAdd={openAddExpense} />
            )}
            {tab === 'people' && <PeopleTab trip={activeTrip} />}
          </main>

          <button
            type="button"
            onClick={openAddExpense}
            aria-label="Add expense"
            className={`fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center gap-2 rounded-2xl bg-zinc-900 text-[15px] font-medium text-white shadow-lg shadow-zinc-900/20 transition hover:bg-zinc-800 active:scale-[0.97] sm:right-[max(1rem,calc(50%-21rem))] dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-black/40 dark:hover:bg-white ${
              tab === 'expenses' ? 'w-auto pr-5 pl-4' : ''
            }`}
          >
            <PlusIcon className="size-5" />
            {tab === 'expenses' && <span>Add expense</span>}
          </button>

          <nav
            aria-label="Sections"
            className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90"
          >
            <ul className="mx-auto grid h-16 max-w-2xl grid-cols-4">
              {TABS.map(({ id, label, icon: Icon }) => {
                const active = tab === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => selectTab(id)}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                        active
                          ? 'text-zinc-900 dark:text-zinc-50'
                          : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300'
                      }`}
                    >
                      {active && (
                        <span className="absolute top-0 h-0.5 w-8 rounded-full bg-zinc-900 dark:bg-zinc-50" aria-hidden="true" />
                      )}
                      <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      )}

      {modal?.type === 'expense' && activeTrip && (
        <ExpenseForm key={modal.expense?.id ?? 'new'} trip={activeTrip} expense={modal.expense} onClose={closeModal} />
      )}
      {modal?.type === 'trips' && <TripsModal onClose={closeModal} initialMode={modal.mode} />}
      {modal?.type === 'settings' && <SettingsModal onClose={closeModal} />}
    </div>
  );
}
