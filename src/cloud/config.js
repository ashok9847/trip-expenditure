// Supabase config comes from build-time env vars (see .env.example).
// These values are public by design: access is enforced by Row Level Security,
// not by keeping the config secret. Without them the app runs local-only.
const env = import.meta.env ?? {};

export const supabaseUrl = env.VITE_SUPABASE_URL || '';
export const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

export const cloudEnabled = Boolean(supabaseUrl && supabaseAnonKey);
