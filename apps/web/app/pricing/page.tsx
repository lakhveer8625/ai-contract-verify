import Link from 'next/link';
import { Check, Minus, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Nav } from '@/components/nav';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const tiers = [
  {
    name: 'Starter',
    price: '$49',
    cadence: 'per month',
    summary: 'For founders and engineers running focused pre-launch reviews.',
    cta: 'Start Starter',
    href: '/audit',
    featured: false,
    highlights: ['10 audits per month', '1 user workspace', 'PDF reports'],
    features: [
      'AI remediation guidance',
      'Slither, Mythril, and AST fallback signals',
      'Gas optimization recommendations',
      'Audit history dashboard',
      'JSON, Markdown, and PDF exports'
    ],
    unavailable: ['GitHub repository scans', 'CI/CD policy gates', 'Dedicated deployment']
  },
  {
    name: 'Pro',
    price: '$249',
    cadence: 'per month',
    summary: 'For product teams reviewing contracts continuously before release.',
    cta: 'Start Pro',
    href: '/audit',
    featured: true,
    highlights: ['Unlimited audits', 'Team workspaces', 'GitHub scans'],
    features: [
      'Everything in Starter',
      'Unlimited contract audit runs',
      'Team audit workspaces',
      'GitHub pull request scan workflow',
      'Priority AI remediation generation',
      'Advanced vulnerability trend dashboard'
    ],
    unavailable: ['Dedicated deployment', 'SLA support']
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: 'annual contract',
    summary: 'For protocols that need private infrastructure and release gates.',
    cta: 'Contact Sales',
    href: '/register',
    featured: false,
    highlights: ['Dedicated deployment', 'CI/CD policy gates', 'SLA support'],
    features: [
      'Everything in Pro',
      'Dedicated cloud or self-hosted deployment',
      'CI/CD policy gates for release approval',
      'Custom detector rules and severity policy',
      'SLA-backed support',
      'Security review onboarding'
    ],
    unavailable: []
  }
];

const comparisonRows = [
  ['Monthly audits', '10', 'Unlimited', 'Unlimited'],
  ['Users', '1', 'Team workspace', 'Organization workspace'],
  ['Reports', 'PDF, Markdown, JSON', 'PDF, Markdown, JSON', 'Custom templates'],
  ['Analyzer coverage', 'Slither, Mythril, AST, AI', 'Slither, Mythril, AST, AI', 'Custom rules plus all analyzers'],
  ['GitHub scans', false, true, true],
  ['CI/CD policy gates', false, false, true],
  ['Dedicated deployment', false, false, true],
  ['Support', 'Standard', 'Priority', 'SLA']
] as const;

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background">
      <Nav />
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-28">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-cyan-100">
            <ShieldCheck className="h-3.5 w-3.5" />
            Audit plans for Solidity teams
          </div>
          <h1 className="text-4xl font-semibold">Pricing for every audit workflow</h1>
          <p className="mt-3 text-muted">Start with fast AI triage and scale into continuous protocol security.</p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={tier.featured ? 'border-primary/45 bg-primary/10 shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_24px_60px_rgba(34,211,238,0.08)]' : ''}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{tier.name}</h2>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-muted">{tier.summary}</p>
                </div>
                {tier.featured && (
                  <span className="shrink-0 rounded-md border border-primary/30 bg-primary/15 px-2 py-1 text-xs text-primary">
                    Popular
                  </span>
                )}
              </div>

              <div className="mt-6">
                <span className="text-4xl font-semibold">{tier.price}</span>
                <span className="ml-2 text-sm text-muted">{tier.cadence}</span>
              </div>

              <div className="mt-5 grid gap-2">
                {tier.highlights.map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-md border border-border bg-slate-950/50 px-3 py-2 text-sm">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3 text-sm">
                {tier.features.map((item) => (
                  <div key={item} className="flex gap-2 text-muted">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span>{item}</span>
                  </div>
                ))}
                {tier.unavailable.map((item) => (
                  <div key={item} className="flex gap-2 text-muted/60">
                    <Minus className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <Link href={tier.href}>
                <Button className="mt-6 w-full gap-2">
                  {tier.featured && <Zap className="h-4 w-4" />}
                  {tier.cta}
                </Button>
              </Link>
            </Card>
          ))}
        </div>

        <section className="mt-12">
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h2 className="text-2xl font-semibold">Feature comparison</h2>
              <p className="mt-2 text-sm text-muted">Compare audit limits, reporting, automation, and support by plan.</p>
            </div>
            <Link href="/audit">
              <Button className="border border-border bg-white/8 text-foreground hover:bg-white/15">Run a sample audit</Button>
            </Link>
          </div>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <div className="grid min-w-[760px] grid-cols-[1.2fr_repeat(3,minmax(0,1fr))] border-b border-border bg-slate-950/50 px-4 py-3 text-sm font-medium">
                <span>Feature</span>
                {tiers.map((tier) => (
                  <span key={tier.name}>{tier.name}</span>
                ))}
              </div>
              {comparisonRows.map(([feature, starter, pro, enterprise]) => (
                <div key={feature} className="grid min-w-[760px] grid-cols-[1.2fr_repeat(3,minmax(0,1fr))] border-b border-border/70 px-4 py-3 text-sm last:border-b-0">
                  <span className="font-medium">{feature}</span>
                  {[starter, pro, enterprise].map((value, index) => (
                    <span key={`${feature}-${index}`} className="text-muted">
                      {typeof value === 'boolean' ? (
                        value ? <Check className="h-4 w-4 text-emerald-300" /> : <Minus className="h-4 w-4 text-muted/60" />
                      ) : (
                        value
                      )}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        </section>
      </section>
    </main>
  );
}
