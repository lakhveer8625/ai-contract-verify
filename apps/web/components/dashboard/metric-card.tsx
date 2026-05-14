import { Card } from '@/components/ui/card';

export function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <div className="mt-3 text-3xl font-semibold">{value}</div>
      <p className="mt-2 text-xs text-muted">{helper}</p>
    </Card>
  );
}
