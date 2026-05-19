import { Nav } from '@/components/nav';
import { AuditWorkspace } from '@/components/audit/audit-workspace';
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function AuditPage() {
  return (
    <main className="min-h-screen bg-background">
      <Nav />
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-24">
        <ProtectedRoute>
          <AuditWorkspace />
        </ProtectedRoute>
      </div>
    </main>
  );
}
