import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { appReducer } from './appReducer.js';
import { loadState, parseState, saveState, STORAGE_KEY } from '../storage/storage.js';

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, undefined, () => loadState());
  const fromOtherTab = useRef(false);
  // Latest state, so `commit` can stay stable and still reduce from current data.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist on every change (skip echoing back state that came from another tab).
  useEffect(() => {
    if (fromOtherTab.current) {
      fromOtherTab.current = false;
      return;
    }
    // A failed save (usually storage full) used to be silent and changes were lost on reload.
    if (!saveState(state)) window.dispatchEvent(new CustomEvent('tripsplit:save-failed'));
  }, [state]);

  // Ask the browser not to evict our data under storage pressure.
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      fromOtherTab.current = true;
      dispatch({ type: 'REPLACE_STATE', state: parseState(e.newValue) });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /**
   * Transactional dispatch: persist the next state first and only apply the
   * action in memory if the save succeeded (R12.21).
   * @returns {boolean} whether the action was saved and applied
   */
  const commit = useCallback((action) => {
    const next = appReducer(stateRef.current, action);
    if (!saveState(next)) return false;
    // Keep the ref current so back-to-back commits build on each other.
    stateRef.current = next;
    dispatch(action);
    return true;
  }, []);

  const value = useMemo(() => {
    const activeTrip = state.trips.find((t) => t.id === state.activeTripId) ?? null;
    return { state, dispatch, commit, activeTrip, currency: state.settings.currency };
  }, [state, commit]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside <AppStateProvider>');
  return ctx;
}
