import React, { useState } from 'react';
import { KeyRound, AlertCircle, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { Alert } from '../common/Input';
import { PasswordField } from '../common/PasswordField';
import { Modal } from '../common/Modal';
import { checkPassword } from '../../utils/security';

/** Shown as a forced modal when an admin has reset the user's password. */
export const ChangePassword = ({ open, onClose, forced = false }) => {
    const { changePassword, logout } = useAuth();
    const toast = useToast();
    const [f, setF] = useState({ current: '', next: '', confirm: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const ok = checkPassword(f.next).valid && f.next === f.confirm && f.current;

    const submit = async () => {
        setError(''); setLoading(true);
        try {
            await changePassword(f.current, f.next);
            toast.success('Your password has been updated.');
            setF({ current: '', next: '', confirm: '' });
            onClose?.();
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    return (
        <Modal open={open} onClose={forced ? undefined : onClose}
            title={forced ? 'Choose a new password' : 'Change your password'}
            subtitle={forced
                ? 'Your administrator reset your password. Please set your own before continuing.'
                : 'Enter your current password, then choose a new one.'}
            footer={<>
                {forced
                    ? <Button variant="ghost" onClick={logout}>Sign out instead</Button>
                    : <Button variant="secondary" onClick={onClose}>Cancel</Button>}
                <Button icon={KeyRound} onClick={submit} loading={loading} disabled={!ok}>
                    Update Password
                </Button>
            </>}>
            {forced && <div className="mb-2"><Alert type="warning" icon={ShieldAlert}>
                You cannot use the portal until you set a new password.
            </Alert></div>}

            {error && <div className="mb-2"><Alert type="error" icon={AlertCircle}>{error}</Alert></div>}

            <PasswordField label={forced ? 'Temporary password from your admin' : 'Current password'}
                value={f.current} onChange={e => setF({ ...f, current: e.target.value })}
                placeholder="Enter your current password" autoComplete="current-password" />

            <PasswordField label="New password" showMeter
                value={f.next} onChange={e => setF({ ...f, next: e.target.value })}
                placeholder="Choose a strong new password" />

            <PasswordField label="Confirm new password"
                value={f.confirm} onChange={e => setF({ ...f, confirm: e.target.value })}
                placeholder="Type the new password again"
                error={f.confirm && f.next !== f.confirm ? 'The two passwords do not match' : ''} />
        </Modal>
    );
};
export default ChangePassword;
