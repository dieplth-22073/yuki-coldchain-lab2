import { requireClient, ok, fail, dbFail } from '@/lib/api';

/**
 * 入荷・検品の記録 (F-002 / F-004 / F-005)。
 * 実測温度が SKU の温度帯閾値を外れていれば、その場で隔離にして保存する。
 * 判定の閾値はコードに埋めず temp_thresholds から読む。
 */
export async function POST(request: Request) {
  const { supabase, error } = await requireClient();
  if (error) return error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('リクエストの形式が不正です。');
  }

  const { lot_code, sku_id, supplier_id, qty, expiry_date, measured_temp, location } =
    body as {
      lot_code?: string;
      sku_id?: string;
      supplier_id?: string;
      qty?: number;
      expiry_date?: string;
      measured_temp?: number;
      location?: string;
    };

  const missing = Object.entries({ lot_code, sku_id, supplier_id, qty, expiry_date })
    .filter(([, v]) => v === undefined || v === null || v === '')
    .map(([k]) => k);
  if (missing.length) {
    return fail(`必須項目が未入力です: ${missing.join(', ')}`);
  }
  if (typeof qty !== 'number' || qty <= 0) {
    return fail('数量は 1 以上で入力してください。');
  }

  const { data: sku, error: skuErr } = await supabase!
    .from('skus')
    .select('id, code, name, temp_band')
    .eq('id', sku_id!)
    .single();
  if (skuErr || !sku) return dbFail('SKU が見つかりません', skuErr);

  const { data: th, error: thErr } = await supabase!
    .from('temp_thresholds')
    .select('min_c, max_c, version')
    .eq('temp_band', sku.temp_band)
    .single();
  if (thErr || !th) return dbFail('温度帯の閾値が取得できません', thErr);

  let status: 'available' | 'quarantined' = 'available';
  let quarantine_reason: string | null = null;

  if (typeof measured_temp === 'number') {
    if (measured_temp < Number(th.min_c) || measured_temp > Number(th.max_c)) {
      status = 'quarantined';
      quarantine_reason =
        `受入時実測温度 ${measured_temp}°C が温度帯の許容範囲 ` +
        `${th.min_c}–${th.max_c}°C を外れています (閾値版 ${th.version})`;
    }
  }

  const { data: lot, error: insErr } = await supabase!
    .from('lots')
    .insert({
      lot_code,
      sku_id,
      supplier_id,
      qty,
      expiry_date,
      measured_temp: measured_temp ?? null,
      location: location ?? null,
      status,
      quarantine_reason,
    })
    .select('*, skus(*), suppliers(*)')
    .single();

  if (insErr) {
    if (insErr.code === '23505') {
      return fail(`ロット番号 ${lot_code} はすでに登録されています。`, 409);
    }
    return dbFail('ロットの登録に失敗しました', insErr);
  }

  return ok({ lot, quarantined: status === 'quarantined', reason: quarantine_reason });
}
