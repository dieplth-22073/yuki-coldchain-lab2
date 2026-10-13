import { requireClient, ok, dbFail } from '@/lib/api';

/** 在庫一覧 (F-011)。SKU・状態・温度帯で絞り込める。 */
export async function GET(request: Request) {
  const { supabase, error } = await requireClient();
  if (error) return error;

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const skuId = url.searchParams.get('sku_id');
  const q = url.searchParams.get('q');

  let query = supabase!
    .from('lots')
    .select('*, skus(*), suppliers(*)')
    .order('expiry_date', { ascending: true });

  if (status) query = query.eq('status', status);
  if (skuId) query = query.eq('sku_id', skuId);
  if (q) query = query.ilike('lot_code', `%${q}%`);

  const { data, error: err } = await query;
  if (err) return dbFail('在庫の取得に失敗しました', err);

  return ok({ lots: data });
}
