import Link from 'next/link';
import { ArrowRight, Bot, FileSearch, Gauge, ShieldAlert } from 'lucide-react';
import { Nav } from '@/components/nav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MotionPanel } from '@/components/motion-panel';

const features = [
  { icon: FileSearch, title: 'Static + AI Analysis', copy: 'Slither, Mythril, AST heuristics, and structured LLM reasoning.' },
  { icon: ShieldAlert, title: 'Professional Reports', copy: 'JSON, Markdown, and PDF reports with executive summaries.' },
  { icon: Gauge, title: 'Gas Intelligence', copy: 'Storage, calldata, loop, immutable, packing, and custom error guidance.' }
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(167,139,250,0.16),transparent_32%),#070b14]">
      <Nav />
      <section className="mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-4 pb-20 pt-28 lg:grid-cols-[1.05fr_0.95fr]">
        <MotionPanel>
          <div className="mb-5 inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-cyan-100">
            AI-first audit workflow for Solidity teams
          </div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-tight tracking-normal md:text-7xl">AI-Powered Smart Contract Security Audits</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            Detect vulnerabilities, optimize gas, and generate professional audit reports using AI.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/audit">
              <Button>
                Start Audit <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button className="border border-border bg-white/8 text-foreground hover:bg-white/15">View Demo</Button>
            </Link>
          </div>
        </MotionPanel>
        <MotionPanel>
        <Card className="relative p-0">
          <div className="border-b border-border p-4 text-sm text-muted">Live audit signal</div>
          <div className="space-y-4 p-5">
            {[
              ['Critical', 'Reentrancy in withdraw()', 'External call before state update'],
              ['High', 'Delegatecall risk', 'Untrusted implementation path'],
              ['Medium', 'Oracle manipulation', 'Missing heartbeat and deviation checks']
            ].map(([severity, title, copy]) => (
              <div key={title} className="rounded-md border border-border bg-slate-950/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{title}</span>
                  <span className="rounded bg-red-500/15 px-2 py-1 text-xs text-red-200">{severity}</span>
                </div>
                <p className="mt-2 text-sm text-muted">{copy}</p>
              </div>
            ))}
          </div>
        </Card>
        </MotionPanel>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="grid gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, title, copy }) => (
            <Card key={title}>
              <Icon className="mb-4 h-6 w-6 text-primary" />
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
            </Card>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="grid gap-6 lg:grid-cols-4">
          {['Upload contracts', 'Run Slither + Mythril', 'AI remediation', 'Investor-ready report'].map((step, index) => (
            <Card key={step}>
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">{index + 1}</div>
              <h3 className="font-semibold">{step}</h3>
            </Card>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-20">
        <Card className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <Bot className="mb-4 h-7 w-7 text-primary" />
            <h2 className="text-3xl font-semibold">Built for security teams, founders, and protocol engineers.</h2>
            <p className="mt-3 text-muted">From quick triage to board-ready PDFs, the workflow stays focused on launch risk.</p>
          </div>
          <Link href="/pricing">
            <Button>View Pricing</Button>
          </Link>
        </Card>
      </section>
      <footer className="border-t border-border px-4 py-8 text-center text-sm text-muted">AegisAI Auditor. AI security tooling for Solidity teams.</footer>
    </main>
  );
}
