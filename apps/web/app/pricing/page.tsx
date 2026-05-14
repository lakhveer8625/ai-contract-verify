import { Nav } from '@/components/nav';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const tiers = [
  ['Starter', '$49', '10 audits per month', 'PDF reports', 'AI remediation'],
  ['Pro', '$249', 'Unlimited audits', 'Team workspaces', 'GitHub scans'],
  ['Enterprise', 'Custom', 'Dedicated deployment', 'CI/CD policy gates', 'SLA support']
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background">
      <Nav />
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-28">
        <h1 className="text-4xl font-semibold">Pricing for every audit workflow</h1>
        <p className="mt-3 max-w-2xl text-muted">Start with fast AI triage and scale into continuous protocol security.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {tiers.map(([name, price, ...items]) => (
            <Card key={name}>
              <h2 className="text-xl font-semibold">{name}</h2>
              <div className="mt-4 text-4xl font-semibold">{price}</div>
              <div className="mt-6 space-y-3 text-sm text-muted">
                {items.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
              <Button className="mt-6 w-full">Choose {name}</Button>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
