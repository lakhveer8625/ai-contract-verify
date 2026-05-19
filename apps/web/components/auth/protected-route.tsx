'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/store/auth';

export function loginPath(next: string) {
  return `/login?next=${encodeURIComponent(next)}`;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuth((state) => state.hydrated);
  const user = useAuth((state) => state.user);

  useEffect(() => {
    if (hydrated && !user) router.replace(loginPath(pathname));
  }, [hydrated, pathname, router, user]);

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return children;
}
