import { requireClient, ok, fail, dbFail } from '@/lib/api';

/**
 * トレーサビリティ検索 (F-028)。
 * 三レーン: 社内ロット番号 / 米産地 / 牛個体識別番号。
 * 記録されたリンクの終端を明示し、推測で補完しない。
 */
export async function GET(request: Request) {
  const { supabase, error } = await requireClient();
  if (error) return error;

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const lane = url.searchParams.get('lane') ?? 'lot';

  if (!q) return fail('検索キーワードを入力してください。');

  const column =
    lane === 'rice' ? 'rice_origin' : lane === 'cattle' ? 'cattle_id' : 'lot_code';

  const { data: lots, error: lotErr } = await supabase!
    .from('lots')
    .select('*, skus(*), suppliers(*)')
    .ilike(column, `%${q}%`)
    .order('expiry_date');
  if (lotErr) return dbFail('ロットの検索に失敗しました', lotErr);

  const lotIds = (lots ?? []).map((l) => l.id);

  // 引当済みロットから、どの受注・顧客に繋がったかを辿る
  let links: unknown[] = [];
  if (lotIds.length) {
    const { data, error: linkErr } = await supabase!
      .from('allocations')
      .select(
        'id, qty, allocated_at, lot_id, lots(lot_code, expiry_date), orders(order_code, status, customers(code, name))',
      )
      .in('lot_id', lotIds);
    if (linkErr) return dbFail('引当の追跡に失敗しました', linkErr);
    links = data ?? [];
  }

  return ok({
    lane,
    query: q,
    lots,
    links,
    // 「記録が途切れる地点」を画面に出すための情報
    note:
      lotIds.length === 0
        ? '該当するロットがありません。'
        : links.length === 0
          ? '該当ロットはまだ引き当てられていないため、配送先までの記録はありません。'
          : null,
  });
}
