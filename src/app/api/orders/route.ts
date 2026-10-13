import { requireClient, ok, fail, dbFail } from '@/lib/api';

/** 受注一覧 (引当状況つき)。 */
export async function GET() {
  const { supabase, error } = await requireClient();
  if (error) return error;

  const { data, error: err } = await supabase!
    .from('orders')
    .select('*, customers(*), skus(*), allocations(*, lots(lot_code, expiry_date))')
    .order('requested_date', { ascending: true });

  if (err) return dbFail('受注の取得に失敗しました', err);
  return ok({ orders: data });
}

/** 受注行作成 (F-012)。 */
export async function POST(request: Request) {
  const { supabase, error } = await requireClient();
  if (error) return error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('リクエストの形式が不正です。');
  }

  const { order_code, customer_id, sku_id, qty, requested_date, delivery_condition } =
    body as Record<string, string | number>;

  const missing = Object.entries({
    order_code,
    customer_id,
    sku_id,
    qty,
    requested_date,
  })
    .filter(([, v]) => v === undefined || v === null || v === '')
    .map(([k]) => k);
  if (missing.length) return fail(`必須項目が未入力です: ${missing.join(', ')}`);
  if (typeof qty !== 'number' || qty <= 0) {
    return fail('数量は 1 以上で入力してください。');
  }

  const { data, error: insErr } = await supabase!
    .from('orders')
    .insert({
      order_code,
      customer_id,
      sku_id,
      qty,
      requested_date,
      delivery_condition: delivery_condition ?? 'curbside',
    })
    .select('*, customers(*), skus(*)')
    .single();

  if (insErr) {
    if (insErr.code === '23505') {
      return fail(`受注番号 ${order_code} はすでに存在します。`, 409);
    }
    return dbFail('受注の登録に失敗しました', insErr);
  }

  return ok({ order: data });
}
