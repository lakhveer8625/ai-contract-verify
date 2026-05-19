'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw } from 'lucide-react';
import { Nav } from '@/components/nav';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusStream } from '@/components/audit/status-stream';
import { VulnerabilityCard } from '@/components/audit/vulnerability-card';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/store/auth';

export default function AuditReportPage() {
  const params = useParams<{ id: string }>();
  const hydrated = useAuth((state) => state.hydrated);
  const user = useAuth((state) => state.user);
  const { data: audit, isLoading, refetch } = useQuery({
    queryKey: ['audit', params.id],
    queryFn: () => api.audit(params.id),
    enabled: hydrated && Boolean(user),
    refetchInterval: (query) => (query.state.data?.status === 'COMPLETED' || query.state.data?.status === 'FAILED' ? false : 3000)
  });

  async function downloadReport(reportId: string, title: string) {
    const response = await fetch(api.reportUrl(reportId), { headers: { Authorization: `Bearer ${getToken()}` } });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${title || 'audit-report'}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-background">
      <Nav />
      <ProtectedRoute>
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-24">
        {isLoading || !audit ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h1 className="text-3xl font-semibold">{audit.title}</h1>
                <p className="mt-2 text-muted">{audit.executiveSummary ?? 'Audit is running. Results will appear as soon as analysis completes.'}</p>
              </div>
              <div className="flex gap-3">
                <Button className="border border-border bg-white/8 text-foreground hover:bg-white/15" onClick={() => refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
                {audit.reports[0] && (
                  <Button onClick={() => downloadReport(audit.reports[0].id, audit.title)}>
                    <Download className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-5">
              <Card className="md:col-span-2">
                <p className="text-sm text-muted">Security Score</p>
                <div className="mt-3 text-6xl font-semibold text-primary">{audit.overallScore}</div>
                <p className="mt-2 text-sm text-muted">out of 100</p>
              </Card>
              {[
                ['Critical', audit.criticalCount],
                ['High', audit.highCount],
                ['Medium', audit.mediumCount]
              ].map(([label, value]) => (
                <Card key={label as string}>
                  <p className="text-sm text-muted">{label}</p>
                  <div className="mt-3 text-4xl font-semibold">{value}</div>
                </Card>
              ))}
            </div>
            <div className="mt-6 grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
              <Card>
                <h2 className="mb-4 font-semibold">Live analysis</h2>
                <StatusStream auditId={audit.id} status={audit.status} />
                <h2 className="mb-3 mt-6 font-semibold">Gas optimization</h2>
                <div className="space-y-3">
                  {(audit.gasOptimizations ?? []).map((item) => (
                    <div key={item.title} className="rounded-md border border-border p-3 text-sm text-muted">
                      <span className="font-medium text-foreground">{item.title}</span>
                      <p className="mt-1">{item.recommendation}</p>
                    </div>
                  ))}
                </div>
              </Card>
              <div className="space-y-4">
                {audit.vulnerabilities.map((vulnerability) => (
                  <VulnerabilityCard key={vulnerability.id} vulnerability={vulnerability} />
                ))}
                {!audit.vulnerabilities.length && <Card className="text-sm text-muted">No vulnerabilities recorded yet.</Card>}
              </div>
            </div>
          </>
        )}
      </div>
      </ProtectedRoute>
    </main>
  );
}
