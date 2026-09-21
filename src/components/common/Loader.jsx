import React from 'react';
import { Loader2, Inbox } from 'lucide-react';

export const Loader = ({ text = 'Loading…', full }) => (
    <div style={{ display: 'grid', placeItems: 'center', padding: full ? '90px 20px' : '40px 20px', gap: 14 }}>
        <Loader2 size={32} className="spin" style={{ color: 'var(--brand)' }} />
        <div className="f-13 text-sub">{text}</div>
    </div>
);

export const EmptyState = ({ icon: Icon = Inbox, title, text, action }) => (
    <div className="empty">
        <div className="empty-icon"><Icon size={28} /></div>
        <div className="empty-title">{title}</div>
        {text && <div className="empty-text">{text}</div>}
        {action && <div className="mt-2">{action}</div>}
    </div>
);
export default Loader;
