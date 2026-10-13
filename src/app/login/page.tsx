'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Alert, Field, inputClass } from '@/components/ui';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const envMissing = params.get('reason') === 'env-missing';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error } = await createClient().auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        /Invalid login credentials/i.test(error.message)
          ? 'メールアドレスまたはパスワードが違います。'
          : error.message,
      );
      setBusy(false);
      return;
    }

    router.push(params.get('redirect') ?? '/');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold tracking-tight">
            食品コールドチェーン業務支援システム
          </h1>
          <p className="mt-1 text-sm text-slate-500">ユキコールドロジスティクス様</p>
        </div>

        {envMissing && (
          <div className="mb-4">
            <Alert tone="bad" title="環境変数が設定されていません">
              <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> と{' '}
              <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> を
              <code className="text-xs"> .env.local</code> に設定してください。
            </Alert>
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <Field label="メールアドレス">
            <input
              type="email"
              required
              autoComplete="username"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="パスワード">
            <input
              type="password"
              required
              autoComplete="current-password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {error && <Alert tone="bad" title={error} />}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          デモ用アカウントは README.md に記載しています。
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
