'use client';

import Link from 'next/link';
import { LogOut, ShieldCheck, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loginPath } from '@/components/auth/protected-route';
import { useAuth } from '@/store/auth';

export function Nav() {
  const hydrated = useAuth((state) => state.hydrated);
  const user = useAuth((state) => state.user);
  const logout = useAuth((state) => state.logout);
  const auditHref = user ? '/audit' : loginPath('/audit');
  const dashboardHref = user ? '/dashboard' : loginPath('/dashboard');

  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-border bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-5 w-5 text-primary" />
          AegisAI
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
          <Link href={dashboardHref}>Dashboard</Link>
          <Link href={auditHref}>Audit</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>
        <div className="flex items-center gap-3">
          {hydrated && user && (
            <div className="hidden items-center gap-2 text-sm text-muted sm:flex">
              <UserCircle className="h-4 w-4" />
              <span className="max-w-40 truncate">{user.name || user.email}</span>
            </div>
          )}
          {hydrated && user ? (
            <>
              <Link href="/audit">
                <Button className="h-9">Start Audit</Button>
              </Link>
              <Button
                type="button"
                className="h-9 border border-border bg-white/8 px-3 text-foreground hover:bg-white/15"
                onClick={logout}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Link href={loginPath('/audit')}>
              <Button className="h-9">Start Audit</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
