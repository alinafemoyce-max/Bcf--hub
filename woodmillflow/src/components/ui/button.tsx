import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-marine text-white hover:bg-marine-700 active:bg-navy shadow-sm',
        navy: 'bg-navy text-white hover:bg-navy-700 shadow-sm',
        secondary: 'bg-white text-ink border border-line-strong hover:bg-surface hover:border-subtle',
        ghost: 'text-ink hover:bg-ink/5',
        subtle: 'bg-marine-50 text-marine-700 hover:bg-[#d8e9f3]',
        success: 'bg-ok text-white hover:bg-[#165c3a] shadow-sm',
        danger: 'bg-white text-danger border border-danger/40 hover:bg-danger-50',
        dangerSolid: 'bg-danger text-white hover:bg-[#931c13] shadow-sm'
      },
      size: {
        sm: 'h-9 px-3 text-sm [&_svg]:size-4',
        md: 'h-11 px-4 text-[15px] [&_svg]:size-[18px]',
        lg: 'h-12 px-5 text-base [&_svg]:size-5',
        xl: 'h-14 px-6 text-[17px] [&_svg]:size-5',
        icon: 'size-11 [&_svg]:size-5'
      }
    },
    defaultVariants: { variant: 'primary', size: 'md' }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
