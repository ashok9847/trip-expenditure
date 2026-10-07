// Google sign-in + live Supabase sync for shared trips.
//
// Local state (the reducer) stays the single source of truth for the UI.
// This provider:
//   • reads: listens to every trip the signed-in email is a member of and
//     merges the server data into local state (MERGE_CLOUD_TRIPS);
//   • writes: after each local change, diffs cloud trips against a "shadow"
//     (the last known server value of each document) and writes only what changed.
// The shadow is updated from snapshots *before* merging, so data that came
// from the server is never echoed back.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../hooks/useAppState.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { cloudEnabled } from './config.js';
import { diffTrip, joinTrip, keys, normEmail, stableStringify, dbTrip, dbExpense, dbMedia } from './model.js';

const CloudContext = createContext({ enabled: false, status: 'disabled', user: null, signIn: async () => {}, signOut: async () => {} });

const tripOfKey = (k) => k.split(':')[1];

export function CloudProvider({ children }) {
  const { state, dispatch } = useAppState();
  const toast = useToast();
  const [status, setStatus] = useState(cloudEnabled ? 'loading' : 'disabled');
  const [user, setUser] = useState(null);
  const [sbReady, setSbReady] = useState(false);
  const sb = useRef(null);
  const shadow = useRef(new Map()); // doc key -> stable JSON of the server value
  const lastMeta = useRef(new Map()); // tripId -> last server trip doc
  const localNew = useRef(new Set()); // trips created/uploaded from this device, not yet on the server
  const synced = useRef(false); // first server snapshot processed
  const loaded = useRef(new Set()); // trips whose trip doc + expenses + media have all arrived
  const [liveReady, setLiveReady] = useState(false); // re-runs the writer once the first snapshot is in
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Load Supabase and follow the auth state ──────────────────────────
  useEffect(() => {
    if (!cloudEnabled) return undefined;
    let alive = true;
    let unsub;
    import('./supabase.js')
      .then((m) => {
        if (!alive) return;
        sb.current = m;
        setSbReady(true);
        unsub = m.watchAuth((u) => {
          if (u?.email && u.email_confirmed_at) {
            setUser({ uid: u.id, email: normEmail(u.email), name: u.user_metadata?.full_name ?? '', photo: u.user_metadata?.avatar_url ?? null });
            setStatus('signed-in');
          } else {
            setUser(null);
            setStatus('signed-out');
          }
        });
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);

  // ── Read: live trips for this user ─────────────────────────────────────
  useEffect(() => {
    if (!user || !sbReady) return undefined;
    const m = sb.current;
    const live = new Map(); // tripId -> { meta, expenses, media, unsubs }
    const removed = new Set();
    let queued = false;
    synced.current = false;

    const fail = (e) => {
      if (e?.code !== 'PGRST301') toast('Sync problem. Changes are kept on this device and will retry.', 'error');
    };
    const flush = () => {
      queued = false;
      const trips = [];
      for (const [tid, t] of live) {
        if (!t.meta || !t.expenses || !t.media) continue; // wait until all three have loaded
        loaded.current.add(tid);
        const prev = stateRef.current.trips.find((x) => x.id === tid);
        const joined = joinTrip(tid, t.meta, t.expenses, t.media, prev);
        if (joined) trips.push(joined);
      }
      dispatch({ type: 'MERGE_CLOUD_TRIPS', trips, removedIds: [...removed] });
      removed.clear();
      if (synced.current) setLiveReady(true);
    };
    const queue = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(flush);
    };
    const dropShadow = (tid, prefix = null) => {
      for (const k of [...shadow.current.keys()]) {
        if (tripOfKey(k) === tid && (!prefix || k.startsWith(prefix))) shadow.current.delete(k);
      }
    };

    const unsubTrips = m.watchMyTrips(
      user.email,
      (rows) => {
        const seen = new Set();
        for (const row of rows) {
          const tid = row.id;
          seen.add(tid);
          localNew.current.delete(tid);
          lastMeta.current.set(tid, row);
          shadow.current.set(keys.trip(tid), stableStringify(row));
          let t = live.get(tid);
          if (!t) {
            t = { meta: null, expenses: null, media: null, unsubs: [] };
            live.set(tid, t);
            t.unsubs.push(
              m.watchExpenses(
                tid,
                (exp) => {
                  dropShadow(tid, 'e:');
                  const map = new Map();
                  for (const e of exp) {
                    map.set(e.id, e);
                    shadow.current.set(keys.expense(tid, e.id), stableStringify(e));
                  }
                  t.expenses = map;
                  queue();
                },
                fail,
              ),
            );
            t.unsubs.push(
              m.watchMedia(
                tid,
                (med) => {
                  dropShadow(tid, 'm:');
                  const map = new Map();
                  for (const x of med) {
                    map.set(x.participant_id, x);
                    shadow.current.set(keys.media(tid, x.participant_id), stableStringify(x));
                  }
                  t.media = map;
                  queue();
                },
                fail,
              ),
            );
          }
          t.meta = row;
        }
        // Trips we lost access to (deleted, or we were removed as a member).
        for (const [tid, t] of live) {
          if (seen.has(tid)) continue;
          t.unsubs.forEach((u) => u());
          live.delete(tid);
          loaded.current.delete(tid);
          dropShadow(tid);
          lastMeta.current.delete(tid);
          removed.add(tid);
        }
        if (!synced.current) {
          // Cached shared trips that are no longer on the server for this account.
          for (const t of stateRef.current.trips) {
            if (t.cloud && !seen.has(t.id) && !localNew.current.has(t.id)) removed.add(t.id);
          }
          synced.current = true;
        }
        queue();
      },
      fail,
    );

    return () => {
      unsubTrips();
      for (const t of live.values()) t.unsubs.forEach((u) => u());
      synced.current = false;
      loaded.current.clear();
      setLiveReady(false);
    };
  }, [user, sbReady, dispatch, toast]);

  // ── Write: push local changes ──────────────────────────────────────────
  useEffect(() => {
    if (!user || !sbReady || !liveReady) return;
    const m = sb.current;

    // 1. Trips that only exist on this device are uploaded to the account.
    const localOnly = state.trips.filter((t) => !t.cloud);
    if (localOnly.length) {
      for (const t of localOnly) {
        localNew.current.add(t.id);
        dispatch({ type: 'SET_TRIP_CLOUD', id: t.id, cloud: { ownerUid: user.uid, ownerEmail: user.email, memberEmails: [user.email] } });
      }
      return; // the next render writes them
    }

    // 2. Changed documents of trips we know the server state of.
    const ops = [];
    for (const t of state.trips) {
      if (!t.cloud) continue;
      // Never write a trip before its server copy has fully loaded: a stale cached
      // copy could otherwise bring back expenses another member deleted.
      if (!loaded.current.has(t.id) && !localNew.current.has(t.id)) continue;
      ops.push(...diffTrip(t, shadow.current));
    }

    // 3. Trips removed locally: the owner deletes them, a member leaves.
    const present = new Set(state.trips.map((t) => t.id));
    const gone = [...new Set([...shadow.current.keys()].map(tripOfKey))].filter((tid) => !present.has(tid));
    const deletions = [];
    for (const tid of gone) {
      const meta = lastMeta.current.get(tid);
      for (const k of [...shadow.current.keys()]) if (tripOfKey(k) === tid) shadow.current.delete(k);
      if (!meta) continue;
      if (meta.owner_uid === user.uid) deletions.push(() => m.supabase.from('trips').delete().eq('id', tid));
      else deletions.push(() => m.leaveTrip(tid, user.email));
    }

    if (!ops.length && !deletions.length) return;

    // Optimistically record what the server will hold; roll back on failure.
    const before = new Map(ops.map((o) => [o.key, shadow.current.get(o.key)]));
    for (const o of ops) {
      if (o.kind === 'set') shadow.current.set(o.key, stableStringify(o.data));
      else shadow.current.delete(o.key);
    }
    (async () => {
      try {
        // Group by trip and sync each trip's full state in one call.
        const byTrip = new Map();
        for (const o of ops) {
          const tid = tripOfKey(o.key);
          if (!byTrip.has(tid)) byTrip.set(tid, { trip: null, expenses: [], media: [] });
          const group = byTrip.get(tid);
          if (o.path[0] === 'trips' && o.path.length === 2) group.trip = o.data;
          if (o.path[2] === 'expenses') group.expenses.push(o.data);
          if (o.path[2] === 'media') group.media.push(o.data);
        }
        for (const [tid, { trip: tripData, expenses: expensesData, media: mediaData }] of byTrip) {
          const t = state.trips.find((x) => x.id === tid);
          if (!t) continue;
          await m.syncTrip(
            tripData || dbTrip(t),
            expensesData.length ? expensesData : t.expenses.map((e) => dbExpense(tid, e)),
            mediaData.length ? mediaData : t.participants.map((p) => dbMedia(tid, p)).filter(Boolean),
          );
        }
        for (const run of deletions) await run();
      } catch (e) {
        for (const [k, v] of before) {
          if (v === undefined) shadow.current.delete(k);
          else shadow.current.set(k, v);
        }
        toast(
          e?.code === 'permission-denied'
            ? 'You don’t have permission for that change on this shared trip.'
            : 'Couldn’t sync. Your changes are saved on this device.',
          'error',
        );
      }
    })();
  }, [state.trips, user, sbReady, liveReady, dispatch, toast]);

  const signIn = useCallback(async () => {
    if (!sb.current) return;
    try {
      await sb.current.signInWithGoogle();
    } catch (e) {
      if (e?.message?.includes('popup')) return; // user closed the OAuth popup
      toast('Google sign-in failed. Please try again.', 'error');
    }
  }, [toast]);

  const signOut = useCallback(async () => {
    if (!sb.current) return;
    await sb.current.signOutUser();
    shadow.current.clear();
    lastMeta.current.clear();
    localNew.current.clear();
    loaded.current.clear();
    dispatch({ type: 'REMOVE_CLOUD_TRIPS' }); // shared data doesn't stay on the device after sign-out
    toast('Signed out');
  }, [dispatch, toast]);

  const value = useMemo(() => ({ enabled: cloudEnabled, status, user, signIn, signOut }), [status, user, signIn, signOut]);
  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

export const useCloud = () => useContext(CloudContext);
