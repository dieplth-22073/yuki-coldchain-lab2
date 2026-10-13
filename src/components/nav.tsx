'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const LINKS = [
  { href: '/', label: 'ダッシュボード' },
  { href: '/receiving', label: '入荷・検品' },
  { href: '/inventory', label: '在庫一覧' },
  { href: '/orders', label: '受注・引当' },
  { href: '/predispatch', label: '出荷前チェック' },
  { href: '/traceability', label: 'トレーサビリティ' },
];

export function Nav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="text-sm font-bold tracking-tight text-slate-900">
          食品コールドチェーン<span className="ml-1 text-slate-400">業務支援</span>
        </span>
        <nav className="flex flex-wrap gap-1">
          {LINKS.map((l) => {
            const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded px-3 py-1.5 text-sm transition ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-xs text-slate-500 sm:inline">{email}</span>
          <button
            onClick={signOut}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            ログアウト
          </button>
        </div>
      </div>
    </header>
  );
}
