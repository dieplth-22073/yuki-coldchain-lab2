import { requireClient, ok, fail, dbFail } from '@/lib/api';

/** 出荷前チェック一覧。 */
export async function GET() {
  const { supabase, error } = await requireClient();
  if (error) return error;

  const { data, error: err } = await supabase!
    .from('predispatch_checks')
    .select('*, orders(order_code, customers(name), skus(code, name, temp_band))')
    .order('checked_at', { ascending: false });

  if (err) return dbFail('出荷前チェックの取得に失敗しました', err);
  return ok({ checks: data });
}

/**
 * 出荷前チェック記録 (F-016)。
 * 車両温度・貨物温度が温度帯を外れていれば逸脱を作成し、出荷確認をブロックする。
 */
export async function POST(request: Request) {
  const { supabase, error } = await requireClient();
  if (error) return error;

  let body: {
    order_id?: string;
    vehicle_temp?: number;
    cargo_temp?: number;
    seal_no?: string;
  };
  try {
    body = await request.json();
  } catch {
    return fail('リクエストの形式が不正です。');
  }

  const { order_id, vehicle_temp, cargo_temp, seal_no } = body;
  if (!order_id || !seal_no) return fail('受注とシール番号は必須です。');
  if (typeof vehicle_temp !== 'number' || typeof cargo_temp !== 'number') {
    return fail('車両温度と貨物温度を数値で入力してください。');
  }

  const { data: order, error: orderErr } = await supabase!
    .from('orders')
    .select('*, skus(code, name, temp_band)')
    .eq('id', order_id)
    .single();
  if (orderErr || !order) return fail('受注が見つかりません。', 404);
  if (order.status !== 'allocated') {
    return fail(
      `この受注は「${order.status}」です。引当済みの受注のみチェックできます。`,
      409,
    );
  }

  const band = (order.skus as { temp_band: string }).temp_band;
  const { data: th, error: thErr } = await supabase!
    .from('temp_thresholds')
    .select('min_c, max_c, version')
    .eq('temp_band', band)
    .single();
  if (thErr || !th) return dbFail('温度帯の閾値が取得できません', thErr);

  const out: string[] = [];
  if (vehicle_temp < Number(th.min_c) || vehicle_temp > Number(th.max_c)) {
    out.push(`車両温度 ${vehicle_temp}°C`);
  }
  if (cargo_temp < Number(th.min_c) || cargo_temp > Number(th.max_c)) {
    out.push(`貨物温度 ${cargo_temp}°C`);
  }

  const failed = out.length > 0;
  const detail = failed
    ? `${out.join(' / ')} が許容範囲 ${th.min_c}–${th.max_c}°C を外れています (閾値版 ${th.version})`
    : `車両 ${vehicle_temp}°C・貨物 ${cargo_temp}°C とも許容範囲 ${th.min_c}–${th.max_c}°C 内です`;

  let deviationId: string | null = null;
  if (failed) {
    const { data: dev, error: devErr } = await supabase!
      .from('deviations')
      .insert({
        kind: 'temperature',
        ref_table: 'orders',
        ref_id: order.id,
        detail,
      })
      .select('id')
      .single();
    if (devErr) return dbFail('逸脱の記録に失敗しました', devErr);
    deviationId = dev.id;
  }

  const { data: check, error: insErr } = await supabase!
    .from('predispatch_checks')
    .insert({
      order_id: order.id,
      vehicle_temp,
      cargo_temp,
      seal_no,
      result: failed ? 'fail' : 'pass',
      detail,
      deviation_id: deviationId,
    })
    .select('*')
    .single();
  if (insErr) return dbFail('チェック結果の登録に失敗しました', insErr);

  // 合格した場合のみ出荷済みへ進める
  if (!failed) {
    const { error: updErr } = await supabase!
      .from('orders')
      .update({ status: 'dispatched' })
      .eq('id', order.id);
    if (updErr) return dbFail('受注ステータスの更新に失敗しました', updErr);
  }

  return ok({ check, blocked: failed, detail, deviationId });
}
