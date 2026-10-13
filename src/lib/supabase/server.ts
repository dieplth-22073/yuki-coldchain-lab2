import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server Component / Route Handler 用の Supabase クライアント。
 * Cookie からセッションを読むため、RLS がログイン済みユーザーとして効く。
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component からは Cookie を書けない。
            // セッション更新は middleware が担当するため、ここは無視してよい。
          }
        },
      },
    },
  );
}
