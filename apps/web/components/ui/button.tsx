import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes } from 'react';

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}
