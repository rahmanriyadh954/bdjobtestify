import React, { useState } from 'react';
import { User, LogIn, AlertCircle, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { Input, Alert } from '../common/Input';
import { PasswordField } from '../common/PasswordField';
import { Modal } from '../common/Modal';

export const Login = ({ onSwitchToRegister }) => {
    const { loginUser } = useAuth();
    const [form, setForm] = useState({ identifier: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.identifier.trim() || !form.password) {
            setError('Please enter both your username and password.');
            return;
        }
        setLoading(true);
        try { await loginUser(form.identifier, form.password); }
        catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    return (
        <>
            <form onSubmit={submit} noValidate>
                {error && <div className="mb-2"><Alert type="error" icon={AlertCircle}>{error}</Alert></div>}

                <Input
                    label="Username or Student ID" icon={User}
                    placeholder="e.g. karim_bd or BJT-2026-00001"
                    value={form.identifier}
                    onChange={e => setForm({ ...form, identifier: e.target.value })}
                    autoComplete="username" autoCapitalize="none" spellCheck="false"
                />

                <PasswordField
                    label="Password" value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Enter your password" autoComplete="current-password"
                />

                <Button type="submit" block size="lg" loading={loading} icon={LogIn} className="mt-1">
                    {loading ? 'Signing in…' : 'Sign In'}
                </Button>

                <div className="text-center mt-2">
                    <button type="button" className="f-13 text-sub" onClick={() => setHelpOpen(true)}
                        style={{ textDecoration: 'underline' }}>
                        Forgot your password?
                    </button>
                </div>

                <div className="text-center mt-2 f-14">
                    <span className="text-sub">Don't have an account? </span>
                    <button type="button" onClick={onSwitchToRegister} style={{ color: 'var(--brand)', fontWeight: 700 }}>
                        Register now
                    </button>
                </div>
            </form>

            <Modal open={helpOpen} onClose={() => setHelpOpen(false)}
                title="Forgot your password?"
                subtitle="Passwords can only be reset by an administrator"
                footer={<Button onClick={() => setHelpOpen(false)}>Got it</Button>}>
                <Alert type="info" icon={KeyRound}>
                    For security reasons, this portal does not allow self-service password resets.
                </Alert>
                <div className="mt-2 f-14 lh-15 text-sub">
                    <p className="mb-1">Contact your exam administrator and give them your <b>username</b> or <b>Student ID</b>.</p>
                    <p className="mb-1">They will set a temporary password for you from their admin panel.</p>
                    <p>When you sign in with that temporary password, you will be asked to choose a new one straight away.</p>
                </div>
            </Modal>
        </>
    );
};
export default Login;
