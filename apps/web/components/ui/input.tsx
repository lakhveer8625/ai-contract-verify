import { cn } from '@/lib/utils';
import { InputHTMLAttributes } from 'react';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('h-10 w-full rounded-md border border-border bg-slate-950/70 px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted/60 disabled:opacity-50', className)} {...props} />;
}
