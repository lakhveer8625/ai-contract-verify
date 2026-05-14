'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Nav } from '@/components/nav';
import { MetricCard } from '@/components/dashboard/metric-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['audit-history'], queryFn: api.history });
  const total = data.length;
  const average = total ? Math.round(data.reduce((sum, audit) => sum + audit.overallScore, 0) / total) : 0;
  const critical = data.reduce((sum, audit) => sum + audit.criticalCount, 0);
  const chartData = data
    .slice()
    .reverse()
    .map((audit) => ({ name: new Date(audit.createdAt).toLocaleDateString(), score: audit.overallScore }));

  return (
    <main className="min-h-screen bg-background">
      <Nav />
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-24">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-semibold">Security dashboard</h1>
            <p className="mt-2 text-muted">Track audit history, score trends, and remediation priorities.</p>
          </div>
          <Link href="/audit">
            <Button>New Audit</Button>
          </Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <MetricCard label="Total audits" value={String(total)} helper="Across this workspace" />
          <MetricCard label="Average score" value={`${average}/100`} helper="Completed scans" />
          <MetricCard label="Critical findings" value={String(critical)} helper="Needs immediate review" />
          <MetricCard label="AI recommendations" value={String(data.reduce((sum, audit) => sum + audit.vulnerabilities.length, 0))} helper="Generated fixes" />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="h-80">
            <h2 className="mb-4 font-semibold">Score trends</h2>
            {isLoading ? (
              <div className="h-56 animate-pulse rounded-md bg-white/5" />
            ) : (
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="score" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.16)" />
                  <XAxis dataKey="name" stroke="#93a4b8" />
                  <YAxis stroke="#93a4b8" domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid rgba(148,163,184,0.2)' }} />
                  <Area dataKey="score" stroke="#22d3ee" fill="url(#score)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
          <Card>
            <h2 className="font-semibold">Recent scans</h2>
            <div className="mt-4 space-y-3">
              {data.slice(0, 5).map((audit) => (
                <Link key={audit.id} href={`/audit/${audit.id}`} className="block rounded-md border border-border bg-slate-950/50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{audit.title}</span>
                    <span className="text-sm text-primary">{audit.overallScore}/100</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{audit.status}</p>
                </Link>
              ))}
              {!data.length && <p className="rounded-md border border-border p-4 text-sm text-muted">No audits yet. Start with a Solidity file or pasted contract.</p>}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
