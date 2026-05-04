import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
}

const toneClass: Record<NonNullable<Props['tone']>, string> = {
  default: 'bg-(--color-secondary) text-(--color-secondary-foreground)',
  success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  destructive: 'bg-(--color-destructive)/15 text-(--color-destructive)',
};

export function StatCard({ label, value, hint, icon, tone = 'default' }: Props) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-medium text-(--color-muted-foreground)">
              {label}
            </div>
            <div className="text-2xl font-semibold tracking-tight">{value}</div>
            {hint && (
              <div className="text-xs text-(--color-muted-foreground)">{hint}</div>
            )}
          </div>
          {icon && (
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', toneClass[tone])}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
