'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import { Alert, Badge, Card, Empty, PageHeader } from '@/components/ui';
import { TEMP_BAND_LABEL, type Lot, type TempBand } from '@/lib/types';

type Data = {
  counts: {
    available: number;
    quarantined: number;
    pendingOrders: number;
    openDeviations: number;
  };
  expiringSoon: Lot[];
  window: { from: string; to: string };
};

export default function DashboardPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Data>('/api/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <Alert tone="bad" title="読み込みに失敗しました">{error}</Alert>;
  if (!data) return <Empty>読み込み中…</Empty>;

  const tiles = [
    { label: '利用可能ロット', value: data.counts.available, href: '/inventory?status=available' },
    { label: '隔離中ロット', value: data.counts.quarantined, href: '/inventory?status=quarantined' },
    { label: '未引当の受注', value: data.counts.pendingOrders, href: '/orders' },
    { label: '未クローズの逸脱', value: data.counts.openDeviations, href: '/predispatch' },
  ];

  return (
    <>
      <PageHeader
        title="ダッシュボード"
        lead="在庫・受注・逸脱の現在値です。数値はすべて Supabase から取得しています。"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400"
          >
            <p className="text-xs text-slate-500">{t.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{t.value}</p>
          </Link>
        ))}
      </div>

      <Card title={`期限が近いロット（${data.window.from} 〜 ${data.window.to}）`}>
        {data.expiringSoon.length === 0 ? (
          <Empty>14 日以内に期限を迎える利用可能ロットはありません。</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-4">ロット</th>
                  <th className="py-2 pr-4">SKU</th>
                  <th className="py-2 pr-4">温度帯</th>
                  <th className="py-2 pr-4 text-right">数量</th>
                  <th className="py-2">期限</th>
                </tr>
              </thead>
              <tbody>
                {data.expiringSoon.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{l.lot_code}</td>
                    <td className="py-2 pr-4">{l.skus?.name}</td>
                    <td className="py-2 pr-4">
                      <Badge tone="info">
                        {TEMP_BAND_LABEL[l.skus?.temp_band as TempBand]}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{l.qty}</td>
                    <td className="py-2">
                      <Badge tone="warn">{l.expiry_date}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
