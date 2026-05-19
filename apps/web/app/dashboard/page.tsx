'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { Nav } from '@/components/nav';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { MetricCard } from '@/components/dashboard/metric-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { Audit } from '@/types/audit';

const selectClass =
  'h-10 w-full rounded-md border border-border bg-slate-950/70 px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30';

const severityColors = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#f59e0b',
  Low: '#3b82f6'
};

const statusColors = ['#22d3ee', '#a78bfa', '#34d399', '#f59e0b', '#f87171', '#94a3b8'];

type SortKey = 'newest' | 'oldest' | 'name' | 'score-desc' | 'score-asc' | 'critical-desc';

export default function DashboardPage() {
  const hydrated = useAuth((state) => state.hydrated);
  const user = useAuth((state) => state.user);
  const { data = [], isLoading } = useQuery({
    queryKey: ['audit-history'],
    queryFn: api.history,
    enabled: hydrated && Boolean(user)
  });

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [severity, setSeverity] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  const statusOptions = useMemo(() => Array.from(new Set(data.map((audit) => audit.status))).sort(), [data]);
  const filteredAudits = useMemo(
    () => filterAndSortAudits(data, { query, status, severity, fromDate, toDate, sort }),
    [data, fromDate, query, severity, sort, status]
  );

  const total = filteredAudits.length;
  const average = total ? Math.round(filteredAudits.reduce((sum, audit) => sum + audit.overallScore, 0) / total) : 0;
  const critical = filteredAudits.reduce((sum, audit) => sum + audit.criticalCount, 0);
  const allFindings = filteredAudits.reduce(
    (sum, audit) => sum + audit.criticalCount + audit.highCount + audit.mediumCount + audit.lowCount,
    0
  );
  const completed = filteredAudits.filter((audit) => audit.status === 'COMPLETED').length;

  const scoreTrendData = useMemo(() => scoreTrend(filteredAudits), [filteredAudits]);
  const severityData = useMemo(() => findingsBySeverity(filteredAudits), [filteredAudits]);
  const statusData = useMemo(() => findingsByStatus(filteredAudits), [filteredAudits]);
  const volumeData = useMemo(() => auditVolume(filteredAudits), [filteredAudits]);

  function clearFilters() {
    setQuery('');
    setStatus('ALL');
    setSeverity('ALL');
    setFromDate('');
    setToDate('');
    setSort('newest');
  }

  return (
    <main className="min-h-screen bg-background">
      <Nav />
      <ProtectedRoute>
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

          <Card className="mt-8">
            <div className="mb-4 flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Filters</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <label className="space-y-1.5 xl:col-span-2">
                <span className="text-xs font-medium uppercase text-muted">Name</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
                  <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search audit name" />
                </div>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase text-muted">From</span>
                <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase text-muted">To</span>
                <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase text-muted">Status</span>
                <select className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="ALL">All statuses</option>
                  {statusOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase text-muted">Severity</span>
                <select className={selectClass} value={severity} onChange={(event) => setSeverity(event.target.value)}>
                  <option value="ALL">Any severity</option>
                  <option value="CRITICAL">Critical present</option>
                  <option value="HIGH">High present</option>
                  <option value="MEDIUM">Medium present</option>
                  <option value="LOW">Low present</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <label className="w-full space-y-1.5 md:max-w-xs">
                <span className="text-xs font-medium uppercase text-muted">Sort</span>
                <select className={selectClass} value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="name">Name A to Z</option>
                  <option value="score-desc">Highest score</option>
                  <option value="score-asc">Lowest score</option>
                  <option value="critical-desc">Most critical findings</option>
                </select>
              </label>
              <Button
                type="button"
                className="gap-2 border border-border bg-white/8 text-foreground hover:bg-white/15"
                onClick={clearFilters}
              >
                <RotateCcw className="h-4 w-4" />
                Clear filters
              </Button>
            </div>
          </Card>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <MetricCard label="Filtered audits" value={String(total)} helper={`${data.length} total in workspace`} />
            <MetricCard label="Average score" value={`${average}/100`} helper="Across filtered scans" />
            <MetricCard label="Critical findings" value={String(critical)} helper="Needs immediate review" />
            <MetricCard label="Completed" value={String(completed)} helper={`${allFindings} total findings`} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <ChartCard title="Score trends" loading={isLoading}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={scoreTrendData}>
                  <defs>
                    <linearGradient id="score" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.16)" />
                  <XAxis dataKey="name" stroke="#93a4b8" />
                  <YAxis stroke="#93a4b8" domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area dataKey="score" stroke="#22d3ee" fill="url(#score)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Findings by severity" loading={isLoading}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityData} layout="vertical" margin={{ left: 10, right: 24 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.16)" />
                  <XAxis type="number" allowDecimals={false} stroke="#93a4b8" />
                  <YAxis type="category" dataKey="name" stroke="#93a4b8" width={70} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {severityData.map((item) => (
                      <Cell key={item.name} fill={severityColors[item.name]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <ChartCard title="Audit volume by day" loading={isLoading}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData}>
                  <CartesianGrid stroke="rgba(148,163,184,0.16)" />
                  <XAxis dataKey="name" stroke="#93a4b8" />
                  <YAxis allowDecimals={false} stroke="#93a4b8" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="audits" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Status breakdown" loading={isLoading}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={46} outerRadius={78} paddingAngle={3}>
                    {statusData.map((item, index) => (
                      <Cell key={item.name} fill={statusColors[index % statusColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card>
              <h2 className="font-semibold">Recent scans</h2>
              <div className="mt-4 space-y-3">
                {filteredAudits.slice(0, 6).map((audit) => (
                  <Link key={audit.id} href={`/audit/${audit.id}`} className="block rounded-md border border-border bg-slate-950/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">{audit.title}</span>
                      <span className="shrink-0 text-sm text-primary">{audit.overallScore}/100</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
                      <span>{audit.status}</span>
                      <span>{new Date(audit.createdAt).toLocaleDateString()}</span>
                    </div>
                  </Link>
                ))}
                {!filteredAudits.length && (
                  <p className="rounded-md border border-border p-4 text-sm text-muted">No audits match the selected filters.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </ProtectedRoute>
    </main>
  );
}

const tooltipStyle = { background: '#0b1220', border: '1px solid rgba(148,163,184,0.2)', color: '#e2e8f0' };

function ChartCard({ title, loading, children }: { title: string; loading: boolean; children: React.ReactNode }) {
  return (
    <Card className="h-80">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {loading ? <div className="h-56 animate-pulse rounded-md bg-white/5" /> : <div className="h-[250px]">{children}</div>}
    </Card>
  );
}

function filterAndSortAudits(
  audits: Audit[],
  filters: { query: string; status: string; severity: string; fromDate: string; toDate: string; sort: SortKey }
) {
  const query = filters.query.trim().toLowerCase();
  const from = filters.fromDate ? startOfDay(filters.fromDate) : undefined;
  const to = filters.toDate ? endOfDay(filters.toDate) : undefined;

  return audits
    .filter((audit) => {
      const createdAt = new Date(audit.createdAt).getTime();
      if (query && !audit.title.toLowerCase().includes(query)) return false;
      if (filters.status !== 'ALL' && audit.status !== filters.status) return false;
      if (from && createdAt < from) return false;
      if (to && createdAt > to) return false;
      if (filters.severity !== 'ALL' && severityCount(audit, filters.severity) <= 0) return false;
      return true;
    })
    .sort((a, b) => sortAudits(a, b, filters.sort));
}

function sortAudits(a: Audit, b: Audit, sort: SortKey) {
  if (sort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  if (sort === 'name') return a.title.localeCompare(b.title);
  if (sort === 'score-desc') return b.overallScore - a.overallScore;
  if (sort === 'score-asc') return a.overallScore - b.overallScore;
  if (sort === 'critical-desc') return b.criticalCount - a.criticalCount;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function scoreTrend(audits: Audit[]) {
  return audits
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((audit) => ({ name: new Date(audit.createdAt).toLocaleDateString(), score: audit.overallScore }));
}

function findingsBySeverity(audits: Audit[]) {
  return [
    { name: 'Critical' as const, value: audits.reduce((sum, audit) => sum + audit.criticalCount, 0) },
    { name: 'High' as const, value: audits.reduce((sum, audit) => sum + audit.highCount, 0) },
    { name: 'Medium' as const, value: audits.reduce((sum, audit) => sum + audit.mediumCount, 0) },
    { name: 'Low' as const, value: audits.reduce((sum, audit) => sum + audit.lowCount, 0) }
  ];
}

function findingsByStatus(audits: Audit[]) {
  const counts = audits.reduce<Record<string, number>>((acc, audit) => {
    acc[audit.status] = (acc[audit.status] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

function auditVolume(audits: Audit[]) {
  const counts = audits.reduce<Record<string, number>>((acc, audit) => {
    const key = new Date(audit.createdAt).toLocaleDateString();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([name, audits]) => ({ name, audits }));
}

function severityCount(audit: Audit, severity: string) {
  if (severity === 'CRITICAL') return audit.criticalCount;
  if (severity === 'HIGH') return audit.highCount;
  if (severity === 'MEDIUM') return audit.mediumCount;
  if (severity === 'LOW') return audit.lowCount;
  return 0;
}

function startOfDay(value: string) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function endOfDay(value: string) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}
