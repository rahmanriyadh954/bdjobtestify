import { createClient } from '@supabase/supabase-js';

const URL = process.env.REACT_APP_SUPABASE_URL;
const KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(URL && KEY && !URL.includes('YOUR-PROJECT'));

if (!isSupabaseConfigured) {
    console.warn(
        '[BD JobTestify] Supabase is not configured.\n' +
        'Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY to your .env file, then restart.'
    );
}

export const supabase = createClient(URL || 'https://placeholder.supabase.co', KEY || 'placeholder', {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'bjt-auth',
    },
});

// Usernames are turned into an internal email so Supabase Auth can manage
// sessions, hashing and tokens for us. Students still log in with a username.
export const AUTH_EMAIL_DOMAIN = 'bdjobtestify.app';
export const usernameToEmail = (username) =>
    `${String(username).trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;

export default supabase;
