import { AuthForm } from '@/components/auth-form';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_36%),#070b14] px-4">
      <AuthForm mode="login" />
    </main>
  );
}
