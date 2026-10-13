import { requireClient, ok, fail, dbFail } from '@/lib/api';
import { planAllocation } from '@/lib/allocation';
import type { Lot } from '@/lib/types';

/**
 * 引当計画 (F-013)。実際には書き込まず、FEFO 候補と日付逆転判定だけを返す。
 * 画面はこの結果を見せてから、ユーザーに引当を確定させる。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase, error } = await requireClient();
  if (error) return error;

  const { id } = await params;

  const { data: order, error: orderErr } = await supabase!
    .from('orders')
    .select('*, customers(*), skus(*)')
    .eq('id', id)
    .single();
  if (orderErr || !order) return fail('受注が見つかりません。', 404);

  // 隔離中・廃棄済みは引当対象外 (F-005 / F-010)
  const { data: lots, error: lotErr } = await supabase!
    .from('lots')
    .select('*, skus(*), suppliers(*)')
    .eq('sku_id', order.sku_id)
    .eq('status', 'available')
    .gt('qty', 0);
  if (lotErr) return dbFail('在庫の取得に失敗しました', lotErr);

  const { data: history, error: histErr } = await supabase!
    .from('delivery_history')
    .select('expiry_date')
    .eq('customer_id', order.customer_id)
    .eq('sku_id', order.sku_id);
  if (histErr) return dbFail('配送実績の取得に失敗しました', histErr);

  const plan = planAllocation(
    (lots ?? []) as Lot[],
    order.qty,
    (history ?? []).map((h) => h.expiry_date as string),
  );

  return ok({
    order,
    plan,
    // 画面で FEFO 順を見せるため、候補一覧もそのまま返す
    availableLots: lots,
    deliveredExpiries: (history ?? []).map((h) => h.expiry_date),
  });
}
