/**
 * 画面から API ルートを叩く共通処理。
 * API 側のエラー文言 (Supabase 一時停止の案内を含む) をそのまま投げ直す。
 */
export type ApiResult<T> = T & { ok: true };

export async function apiGet<T>(url: string): Promise<ApiResult<T>> {
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new ApiError(json.message ?? `取得に失敗しました (HTTP ${res.status})`, json);
  }
  return json as ApiResult<T>;
}

export async function apiSend<T>(
  url: string,
  body: unknown,
  method: 'POST' | 'PATCH' = 'POST',
): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new ApiError(json.message ?? `送信に失敗しました (HTTP ${res.status})`, json);
  }
  return json as ApiResult<T>;
}

export class ApiError extends Error {
  payload: Record<string, unknown>;
  constructor(message: string, payload: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.payload = payload;
  }
}
