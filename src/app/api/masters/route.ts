import { requireClient, ok, dbFail } from '@/lib/api';

/** 画面のフォームが使うマスター一式。 */
export async function GET() {
  const { supabase, error } = await requireClient();
  if (error) return error;

  const [skus, suppliers, customers, thresholds] = await Promise.all([
    supabase!.from('skus').select('*').order('code'),
    supabase!.from('suppliers').select('*').order('code'),
    supabase!.from('customers').select('*').order('code'),
    supabase!.from('temp_thresholds').select('*').order('temp_band'),
  ]);

  const firstError =
    skus.error ?? suppliers.error ?? customers.error ?? thresholds.error;
  if (firstError) return dbFail('マスターの取得に失敗しました', firstError);

  return ok({
    skus: skus.data,
    suppliers: suppliers.data,
    customers: customers.data,
    thresholds: thresholds.data,
  });
}
