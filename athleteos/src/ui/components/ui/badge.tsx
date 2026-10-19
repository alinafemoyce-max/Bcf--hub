import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary/20 text-accent',
      secondary: 'border-transparent bg-secondary text-secondary-foreground',
      outline: 'text-muted-foreground',
      success: 'border-transparent bg-success/15 text-success',
      warning: 'border-transparent bg-warning/15 text-warning',
      danger: 'border-transparent bg-danger/15 text-danger'
    }
  },
  defaultVariants: { variant: 'default' }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
