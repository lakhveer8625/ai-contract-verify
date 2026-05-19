'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/store/auth';

function Field({ id, label, ...props }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </label>
      <Input id={id} {...props} />
    </div>
  );
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const next = safeNext(searchParams.get('next'));

  useEffect(() => {
    if (auth.hydrated && auth.user) router.replace(next);
  }, [auth.hydrated, auth.user, next, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') await auth.login(email, password);
      else await auth.register({ email, password, name, company });
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === 'login';

  return (
    <Card className="w-full max-w-md space-y-6 p-8">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isLogin ? 'Welcome back' : 'Create your workspace'}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {isLogin
              ? 'Sign in to access your audit dashboard.'
              : 'Start auditing smart contracts in minutes.'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={submit} className="space-y-4">
        {!isLogin && (
          <div className="grid grid-cols-2 gap-3">
            <Field id="name" label="Name" placeholder="Alice" value={name} onChange={(e) => setName(e.target.value)} />
            <Field id="company" label="Company" placeholder="Acme Labs" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
        )}
        <Field
          id="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          required
          minLength={8}
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          placeholder={isLogin ? '••••••••' : 'Min. 8 characters'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3">
            <span className="mt-px text-red-400">!</span>
            <p className="text-sm leading-5 text-red-300">{error}</p>
          </div>
        )}

        <Button type="submit" className="mt-2 w-full gap-2" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[#0b1220] px-2 text-muted">
            {isLogin ? 'New to AegisAI?' : 'Already have an account?'}
          </span>
        </div>
      </div>

      <p className="text-center text-sm">
        <Link
          href={isLogin ? `/register?next=${encodeURIComponent(next)}` : `/login?next=${encodeURIComponent(next)}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {isLogin ? 'Create a free account' : 'Sign in instead'}
        </Link>
      </p>
    </Card>
  );
}

function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}
