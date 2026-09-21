import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

const ToastContext = createContext(null);
const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };
const COLORS = { success: 'var(--success)', error: 'var(--danger)', warning: 'var(--warning)', info: 'var(--primary)' };

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const push = useCallback((message, type = 'info', duration = 3200) => {
        const id = Date.now() + Math.random();
        setToasts(t => [...t, { id, message, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
    }, []);

    const toast = {
        success: (m) => push(m, 'success'),
        error:   (m) => push(m, 'error', 4200),
        warning: (m) => push(m, 'warning'),
        info:    (m) => push(m, 'info'),
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="toast-zone">
                {toasts.map(t => {
                    const Icon = ICONS[t.type];
                    return (
                        <div key={t.id} className={`toast ${t.type}`}>
                            <Icon size={17} style={{ color: COLORS[t.type], flexShrink: 0 }} />
                            <span>{t.message}</span>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
};
