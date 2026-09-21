import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Rendered via createPortal straight onto document.body. This matters on
 * mobile and inside any scrollable/constrained parent (a sidebar's stacking
 * context, a card with overflow hidden, etc.) — without a portal, a modal
 * mounted deep in the tree can get clipped or fail to cover the full
 * viewport. Portalling it guarantees the dialog always sits above and
 * covers everything, on every screen size.
 */
export const Modal = ({ open, onClose, title, subtitle, children, footer, size = '' }) => {
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const esc = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', esc);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const t = setTimeout(() => ref.current?.focus(), 40);
        return () => {
            window.removeEventListener('keydown', esc);
            document.body.style.overflow = prev;
            clearTimeout(t);
        };
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
            <div className={`modal ${size ? `modal-${size}` : ''}`} role="dialog" aria-modal="true"
                aria-label={title} tabIndex={-1} ref={ref}>
                <div className="modal-head">
                    <div style={{ minWidth: 0 }}>
                        <div className="modal-title">{title}</div>
                        {subtitle && <div className="modal-sub">{subtitle}</div>}
                    </div>
                    {onClose && (
                        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
                            <X size={19} />
                        </button>
                    )}
                </div>
                <div className="modal-body">{children}</div>
                {footer && <div className="modal-foot">{footer}</div>}
            </div>
        </div>,
        document.body
    );
};
export default Modal;
