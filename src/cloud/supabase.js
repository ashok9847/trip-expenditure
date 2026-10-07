// Supabase setup. Imported lazily (only when cloud is configured) so the
// local-only app doesn't pay for the SDK.
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from './config.js';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });
  if (error) throw error;
}

export const signOutUser = () => supabase.auth.signOut();
export const watchAuth = (cb) => supabase.auth.onAuthStateChange((_, session) => cb(session?.user ?? null));

/** Live list of trips the signed-in email is a member of. */
export function watchMyTrips(email, onChange, onError) {
  let alive = true;
  const channel = supabase
    .channel('my-trips')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `member_emails.cs.{${email}}` }, () => {
      if (alive) fetchTrips();
    })
    .subscribe();

  const fetchTrips = async () => {
    if (!alive) return;
    try {
      const { data, error } = await supabase.from('trips').select('*').contains('member_emails', [email]);
      if (error) throw error;
      if (alive) onChange(data ?? []);
    } catch (e) {
      if (alive) onError(e);
    }
  };
  fetchTrips();

  return () => {
    alive = false;
    supabase.removeChannel(channel);
  };
}

export function watchExpenses(tripId, onChange, onError) {
  let alive = true;
  const channel = supabase
    .channel(`expenses-${tripId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `trip_id=eq.${tripId}` }, () => {
      if (alive) fetchExpenses();
    })
    .subscribe();

  const fetchExpenses = async () => {
    if (!alive) return;
    try {
      const { data, error } = await supabase.from('expenses').select('*').eq('trip_id', tripId);
      if (error) throw error;
      if (alive) onChange(data ?? []);
    } catch (e) {
      if (alive) onError(e);
    }
  };
  fetchExpenses();

  return () => {
    alive = false;
    supabase.removeChannel(channel);
  };
}

export function watchMedia(tripId, onChange, onError) {
  let alive = true;
  const channel = supabase
    .channel(`media-${tripId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'media', filter: `trip_id=eq.${tripId}` }, () => {
      if (alive) fetchMedia();
    })
    .subscribe();

  const fetchMedia = async () => {
    if (!alive) return;
    try {
      const { data, error } = await supabase.from('media').select('*').eq('trip_id', tripId);
      if (error) throw error;
      if (alive) onChange(data ?? []);
    } catch (e) {
      if (alive) onError(e);
    }
  };
  fetchMedia();

  return () => {
    alive = false;
    supabase.removeChannel(channel);
  };
}

/** Upsert a trip and its children in one transaction (uses RPC for atomicity). */
export async function syncTrip(trip, expenses, media) {
  const { error } = await supabase.rpc('sync_trip', {
    p_trip: trip,
    p_expenses: expenses,
    p_media: media,
  });
  if (error) throw error;
}

/** Delete a trip (owner only, cascades to expenses and media). */
export async function deleteTrip(tripId) {
  const { error } = await supabase.from('trips').delete().eq('id', tripId);
  if (error) throw error;
}

/** Leave a trip (remove yourself from member_emails). */
export async function leaveTrip(tripId, email) {
  const { data: trip, error: fetchErr } = await supabase.from('trips').select('member_emails').eq('id', tripId).single();
  if (fetchErr) throw fetchErr;
  const memberEmails = (trip.member_emails ?? []).filter((e) => e !== email);
  const { error } = await supabase.from('trips').update({ member_emails: memberEmails }).eq('id', tripId);
  if (error) throw error;
}
