import { requireClient, ok, fail, dbFail } from '@/lib/api';
import { checkDateReversal } from '@/lib/allocation';

/**
 * 引当の確定 (F-013)。
 * 日付逆転の判定は画面の結果を信用せず、ここで必ずやり直す。
 * 逆転する場合は override=true と理由が揃っていなければ 409 で拒否する。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase, error } = await requireClient();
  if (error) return error;

  const { id } = await params;

  let body: { lot_id?: string; override?: boolean; reason?: string };
  try {
    body = await request.json();
  } catch {
    return fail('リクエストの形式が不正です。');
  }
  if (!body.lot_id) return fail('引き当てるロットが指定されていません。');

  const { data: order, error: orderErr } = await supabase!
    .from('orders')
    .select('*')
    .eq('id', id)
    .single();
  if (orderErr || !order) return fail('受注が見つかりません。', 404);
  if (order.status !== 'created') {
    return fail(`この受注はすでに「${order.status}」です。引当できません。`, 409);
  }

  const { data: lot, error: lotErr } = await supabase!
    .from('lots')
    .select('*')
    .eq('id', body.lot_id)
    .single();
  if (lotErr || !lot) return fail('ロットが見つかりません。', 404);

  if (lot.sku_id !== order.sku_id) return fail('受注とロットの SKU が一致しません。');
  if (lot.status !== 'available') {
    return fail(`ロット ${lot.lot_code} は「${lot.status}」のため引当できません。`, 409);
  }
  if (lot.qty < order.qty) {
    return fail(`ロット ${lot.lot_code} の在庫 ${lot.qty} が要求数量 ${order.qty} に不足しています。`, 409);
  }

  const { data: history, error: histErr } = await supabase!
    .from('delivery_history')
    .select('expiry_date')
    .eq('customer_id', order.customer_id)
    .eq('sku_id', order.sku_id);
  if (histErr) return dbFail('配送実績の取得に失敗しました', histErr);

  const reversal = checkDateReversal(
    lot.expiry_date,
    (history ?? []).map((h) => h.expiry_date as string),
  );

  const overriding = reversal.violated && body.override === true;
  if (reversal.violated && !overriding) {
    return fail(reversal.message, 409, { reversal, requiresOverride: true });
  }
  if (overriding && !body.reason?.trim()) {
    return fail('日付逆転を承知で引き当てる場合は理由の入力が必要です。', 400, {
      reversal,
      requiresOverride: true,
    });
  }

  // 逆転を承知で進める場合のみ逸脱として記録に残す
  let deviationId: string | null = null;
  if (overriding) {
    const { data: dev, error: devErr } = await supabase!
      .from('deviations')
      .insert({
        kind: 'date_reversal',
        ref_table: 'orders',
        ref_id: order.id,
        detail: `${reversal.message} 理由: ${body.reason!.trim()}`,
      })
      .select('id')
      .single();
    if (devErr) return dbFail('逸脱の記録に失敗しました', devErr);
    deviationId = dev.id;
  }

  const { data: allocation, error: allocErr } = await supabase!
    .from('allocations')
    .insert({
      order_id: order.id,
      lot_id: lot.id,
      qty: order.qty,
      reversal_override: overriding,
      override_reason: overriding ? body.reason!.trim() : null,
    })
    .select('*')
    .single();
  if (allocErr) {
    if (allocErr.code === '23505') return fail('この受注はすでに引当済みです。', 409);
    return dbFail('引当の登録に失敗しました', allocErr);
  }

  const { error: lotUpdErr } = await supabase!
    .from('lots')
    .update({ qty: lot.qty - order.qty })
    .eq('id', lot.id);
  if (lotUpdErr) return dbFail('在庫数量の更新に失敗しました', lotUpdErr);

  const { error: ordUpdErr } = await supabase!
    .from('orders')
    .update({ status: 'allocated' })
    .eq('id', order.id);
  if (ordUpdErr) return dbFail('受注ステータスの更新に失敗しました', ordUpdErr);

  return ok({ allocation, reversal, deviationId, overridden: overriding });
}
