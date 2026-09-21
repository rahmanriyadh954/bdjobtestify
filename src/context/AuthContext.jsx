import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, usernameToEmail, isSupabaseConfigured } from '../utils/supabaseClient';
import * as db from '../services/db';
import {
    cleanText, checkPassword, firstPasswordError,
    usernameError, validateFullName, validatePhoneNumber, rateLimiter,
} from '../utils/security';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [session, setSession]   = useState(null);
    const [profile, setProfile]   = useState(null);
    const [loading, setLoading]   = useState(true);
    const [configError]           = useState(!isSupabaseConfigured);

    // ── Load the profile row for a signed-in user ──────────────────────────
    const loadProfile = useCallback(async (userId) => {
        const { data, error } = await supabase
            .from('profiles').select('*').eq('id', userId).maybeSingle();
        if (error) { console.error('[auth] profile', error); return null; }
        return data;
    }, []);

    // ── Bootstrap + listen for auth changes ────────────────────────────────
    useEffect(() => {
        if (!isSupabaseConfigured) { setLoading(false); return; }
        let alive = true;

        supabase.auth.getSession().then(async ({ data: { session: s } }) => {
            if (!alive) return;
            if (s?.user) {
                const p = await loadProfile(s.user.id);
                if (!alive) return;
                if (p && p.is_active === false) { await supabase.auth.signOut(); }
                else { setSession(s); setProfile(p); }
            }
            setLoading(false);
        });

        const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
            if (!alive) return;
            if (event === 'SIGNED_OUT' || !s?.user) { setSession(null); setProfile(null); return; }
            setSession(s);
            const p = await loadProfile(s.user.id);
            if (alive) setProfile(p);
        });

        return () => { alive = false; sub?.subscription?.unsubscribe(); };
    }, [loadProfile]);

    // ── Sign in with username (or student ID) ──────────────────────────────
    const loginUser = useCallback(async (identifier, password) => {
        const id = cleanText(identifier).trim();
        if (!id) throw new Error('Please enter your username or student ID.');
        if (!password) throw new Error('Please enter your password.');

        const rlKey = `login_${id.toLowerCase()}`;
        if (!rateLimiter.check(rlKey)) {
            throw new Error(`Too many failed attempts. Please wait ${rateLimiter.getRemainingTime(rlKey)} minute(s).`);
        }

        let username = id;

        // Allow signing in with a student ID such as BJT-2026-00001
        if (/^BJT-/i.test(id)) {
            const { data } = await supabase
                .from('profiles').select('username').ilike('student_id', id).maybeSingle();
            if (data?.username) username = data.username;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: usernameToEmail(username),
            password,
        });

        if (error) {
            rateLimiter.record(rlKey);
            if (/invalid login/i.test(error.message)) {
                throw new Error('Wrong username or password. If you forgot your password, ask your admin to reset it.');
            }
            throw new Error(error.message);
        }

        const p = await loadProfile(data.user.id);
        if (p && p.is_active === false) {
            await supabase.auth.signOut();
            throw new Error('This account has been deactivated. Please contact your admin.');
        }

        rateLimiter.reset(rlKey);
        setSession(data.session);
        setProfile(p);
        return p;
    }, [loadProfile]);

    // ── Register ───────────────────────────────────────────────────────────
    const registerUser = useCallback(async ({ name, username, password, confirm, phone }) => {
        if (!validateFullName(name || '')) throw new Error('Please enter your full name (3–60 characters).');
        const uErr = usernameError(username || '');
        if (uErr) throw new Error(uErr);
        const pErr = firstPasswordError(password || '');
        if (pErr) throw new Error(pErr);
        if (password !== confirm) throw new Error('The two passwords do not match.');

        // ── PHONE IS OPTIONAL ──────────────────────────────────────────────
        // Phone collection is switched off right now. To turn it back on:
        //   1. Uncomment the block below.
        //   2. Uncomment the phone field in components/auth/Register.jsx.
        // if (!phone?.trim()) throw new Error('Please enter your phone number.');
        // if (!validatePhoneNumber(phone)) throw new Error('Enter a valid Bangladeshi number (e.g. 01712345678).');

        if (phone?.trim() && !validatePhoneNumber(phone)) {
            throw new Error('That phone number does not look valid. Leave it blank or enter e.g. 01712345678.');
        }

        const uname = username.trim().toLowerCase();

        const { data: taken } = await supabase
            .from('profiles').select('username').eq('username', uname).maybeSingle();
        if (taken) throw new Error('That username is already taken. Please choose another.');

        const { data, error } = await supabase.auth.signUp({
            email: usernameToEmail(uname),
            password,
            options: {
                data: {
                    full_name: cleanText(name.trim(), 60),
                    username: uname,
                    phone: phone?.trim() || '',
                },
            },
        });

        if (error) {
            if (/already registered/i.test(error.message)) {
                throw new Error('That username is already taken. Please choose another.');
            }
            throw new Error(error.message);
        }
        if (!data.session) {
            throw new Error('Account created. Please sign in now.');
        }

        // The DB trigger creates the profile; give it a moment, then read it.
        await new Promise(r => setTimeout(r, 500));
        const p = await loadProfile(data.user.id);
        setSession(data.session);
        setProfile(p);
        return p;
    }, [loadProfile]);

    // ── Change own password (requires the current one) ─────────────────────
    const changePassword = useCallback(async (currentPassword, newPassword) => {
        if (!profile) throw new Error('You are not signed in.');
        const pErr = firstPasswordError(newPassword);
        if (pErr) throw new Error(pErr);
        if (currentPassword === newPassword) {
            throw new Error('Your new password must be different from the current one.');
        }

        // Re-verify the current password before allowing the change
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
            email: usernameToEmail(profile.username), password: currentPassword,
        });
        if (verifyErr) throw new Error('Your current password is incorrect.');

        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw new Error(error.message);

        if (profile.must_change_password) {
            await db.clearMustChangePassword(profile.id);
            setProfile(p => ({ ...p, must_change_password: false }));
        }
        return true;
    }, [profile]);

    const logout = useCallback(async () => {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
    }, []);

    const refreshProfile = useCallback(async () => {
        if (!session?.user) return;
        setProfile(await loadProfile(session.user.id));
    }, [session, loadProfile]);

    const value = {
        session,
        profile,
        user: profile,
        loading,
        configError,
        isAdmin:   profile?.role === 'admin',
        isStudent: profile?.role === 'student',
        mustChangePassword: Boolean(profile?.must_change_password),
        loginUser, registerUser, logout, changePassword, refreshProfile,
        checkPassword,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
    return ctx;
};
export const useAuth = useAuthContext;
