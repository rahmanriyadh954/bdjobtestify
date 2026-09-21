import React, { useState } from 'react';
import { UserPlus, User, AtSign, AlertCircle, ShieldCheck /*, Phone */ } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { Input, Alert } from '../common/Input';
import { PasswordField } from '../common/PasswordField';
import { checkPassword } from '../../utils/security';

export const Register = ({ onSwitchToLogin }) => {
    const { registerUser } = useAuth();
    const [form, setForm] = useState({
        name: '', username: '', password: '', confirm: '',
        phone: '',   // kept in state so re-enabling the field needs no other change
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    const pwOk = checkPassword(form.password).valid;
    const match = form.confirm && form.password === form.confirm;

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try { await registerUser(form); }
        catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    return (
        <form onSubmit={submit} noValidate>
            {error && <div className="mb-2"><Alert type="error" icon={AlertCircle}>{error}</Alert></div>}

            <Input label="Full Name" icon={User} placeholder="Your full name"
                value={form.name} onChange={set('name')} autoComplete="name" />

            <Input label="Username" icon={AtSign} placeholder="e.g. karim_bd"
                value={form.username} onChange={set('username')}
                autoComplete="username" autoCapitalize="none" spellCheck="false"
                hint="4–20 characters. Letters, numbers and underscore only. You will sign in with this." />

            {/* ─────────────────────────────────────────────────────────────
                PHONE NUMBER — currently switched off (it is optional).
                To turn it back on:
                  1. Delete the opening and closing comment markers below.
                  2. Uncomment the Phone icon in the import at the top of this file.
                  3. Uncomment the phone checks in context/AuthContext.jsx → registerUser.
                The database column already exists and accepts nulls, so nothing
                else needs to change.
            ───────────────────────────────────────────────────────────── */}
            {/*
            <Input label="Phone Number" optional icon={Phone} placeholder="01XXXXXXXXX"
                value={form.phone} onChange={set('phone')}
                autoComplete="tel" inputMode="numeric"
                hint="Bangladeshi mobile number, e.g. 01712345678" />
            */}

            <PasswordField label="Password" showMeter
                value={form.password} onChange={set('password')}
                placeholder="Create a strong password" />

            <PasswordField label="Confirm Password"
                value={form.confirm} onChange={set('confirm')}
                placeholder="Type the password again"
                error={form.confirm && !match ? 'The two passwords do not match' : ''} />

            <Button type="submit" block size="lg" loading={loading} icon={UserPlus}
                disabled={!pwOk || !match} className="mt-1">
                {loading ? 'Creating your account…' : 'Create Account'}
            </Button>

            <div className="flex center jcenter gap-1 mt-2 f-11 text-mute">
                <ShieldCheck size={13} /> You will get a unique Student ID automatically
            </div>

            <div className="text-center mt-2 f-14">
                <span className="text-sub">Already registered? </span>
                <button type="button" onClick={onSwitchToLogin} style={{ color: 'var(--brand)', fontWeight: 700 }}>
                    Sign in
                </button>
            </div>
        </form>
    );
};
export default Register;
