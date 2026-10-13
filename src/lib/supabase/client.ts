import { createBrowserClient } from '@supabase/ssr';

/** Client Component 用の Supabase クライアント (ログイン画面などで使用)。 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
