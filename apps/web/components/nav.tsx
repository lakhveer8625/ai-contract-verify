import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Nav() {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-border bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-5 w-5 text-primary" />
          AegisAI
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/audit">Audit</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>
        <Link href="/login">
          <Button className="h-9">Start Audit</Button>
        </Link>
      </div>
    </header>
  );
}
