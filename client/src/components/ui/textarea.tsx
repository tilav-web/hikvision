import * as React from 'react';
import { cn } from '@/lib/utils';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[80px] w-full rounded-md border border-(--color-border) bg-(--color-background) px-3 py-2 text-sm shadow-xs transition-colors',
      'placeholder:text-(--color-muted-foreground)',
      'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--color-ring)',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
