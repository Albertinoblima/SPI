import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'secondary';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
}

const variantClass: Record<ButtonVariant, string> = {
    default: 'bg-blue-600 text-white hover:bg-blue-500 border border-blue-600',
    outline: 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 border border-transparent',
    secondary: 'bg-slate-700 text-white hover:bg-slate-600 border border-slate-700',
};

const sizeClass: Record<ButtonSize, string> = {
    sm: 'text-xs px-3 py-1.5 rounded-lg',
    md: 'text-sm px-4 py-2 rounded-lg',
};

export function Button({
    children,
    className,
    variant = 'default',
    size = 'md',
    type = 'button',
    ...props
}: PropsWithChildren<ButtonProps>) {
    const classes = [
        'inline-flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variantClass[variant],
        sizeClass[size],
        className || '',
    ].join(' ').trim();

    return (
        <button type={type} className={classes} {...props}>
            {children}
        </button>
    );
}