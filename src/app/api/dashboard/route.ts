import { requireClient, ok, dbFail } from '@/lib/api';

/** ダッシュボードの件数。期限が近いロットと未引当の受注を前面に出す。 */
export async function GET() {
  const { supabase, error } = await requireClient();
  if (error) return error;

  const today = new Date().toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);

  const [available, quarantined, pending, deviations, expiring] = await Promise.all([
    supabase!.from('lots').select('id', { count: 'exact', head: true }).eq('status', 'available'),
    supabase!.from('lots').select('id', { count: 'exact', head: true }).eq('status', 'quarantined'),
    supabase!.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'created'),
    supabase!.from('deviations').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase!
      .from('lots')
      .select('*, skus(code, name, temp_band)')
      .eq('status', 'available')
      .gte('expiry_date', today)
      .lte('expiry_date', in14)
      .order('expiry_date'),
  ]);

  const firstError =
    available.error ?? quarantined.error ?? pending.error ?? deviations.error ?? expiring.error;
  if (firstError) return dbFail('ダッシュボードの取得に失敗しました', firstError);

  return ok({
    counts: {
      available: available.count ?? 0,
      quarantined: quarantined.count ?? 0,
      pendingOrders: pending.count ?? 0,
      openDeviations: deviations.count ?? 0,
    },
    expiringSoon: expiring.data ?? [],
    window: { from: today, to: in14 },
  });
}
