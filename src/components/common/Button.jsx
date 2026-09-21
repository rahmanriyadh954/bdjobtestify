import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({
    children, variant = 'primary', size = '', block, loading,
    icon: Icon, iconRight, className = '', ...props
}) => (
    <button
        className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${block ? 'btn-block' : ''} ${className}`}
        disabled={loading || props.disabled}
        {...props}
    >
        {loading ? <Loader2 size={16} className="spin" /> : (Icon && !iconRight && <Icon size={16} />)}
        {children}
        {!loading && Icon && iconRight && <Icon size={16} />}
    </button>
);
export default Button;
