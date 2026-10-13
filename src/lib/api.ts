import { NextResponse } from 'next/server';
import { createClient } from './supabase/server';

/** API ルート共通: 認証済みクライアントを返す。未認証なら 401 を返す。 */
export async function requireClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase: null, user: null, error: fail('ログインが必要です。', 401) };
  }
  return { supabase, user, error: null };
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, message, ...extra }, { status });
}

export function ok<T>(data: T) {
  return NextResponse.json({ ok: true, ...data });
}

/**
 * Supabase のエラーを画面に出せる文言へ。
 * 接続断は LAB の運用上よくあるため、Resume を促す文言を混ぜる。
 */
export function dbFail(message: string, err: { message?: string } | null) {
  const raw = err?.message ?? '';
  const looksPaused =
    /fetch failed|ENOTFOUND|ECONNREFUSED|timeout|Project is paused/i.test(raw);
  return fail(
    looksPaused
      ? `${message} — Supabase プロジェクトが一時停止している可能性があります。ダッシュボードで «Resume project» を押してから再実行してください。`
      : `${message}${raw ? ` (${raw})` : ''}`,
    looksPaused ? 503 : 500,
  );
}
