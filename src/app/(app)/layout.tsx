import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/nav';

/**
 * ログイン済みの画面すべてを包むレイアウト。
 * middleware でも弾いているが、ここでも確認して二重にゲートをかける。
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <>
      <Nav email={user.email ?? ''} />
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </>
  );
}
