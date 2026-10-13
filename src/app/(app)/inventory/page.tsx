'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiGet } from '@/lib/fetcher';
import { Alert, Badge, Card, Empty, PageHeader, inputClass } from '@/components/ui';
import {
  LOT_STATUS_LABEL,
  TEMP_BAND_LABEL,
  type Lot,
  type LotStatus,
  type Sku,
  type TempBand,
} from '@/lib/types';

const STATUS_TONE: Record<LotStatus, 'good' | 'bad' | 'info' | 'neutral'> = {
  available: 'good',
  quarantined: 'bad',
  released: 'info',
  disposed: 'neutral',
};

function InventoryView() {
  const params = useSearchParams();
  const [lots, setLots] = useState<Lot[] | null>(null);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [skuId, setSkuId] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const sp = new URLSearchParams();
    if (status) sp.set('status', status);
    if (skuId) sp.set('sku_id', skuId);
    if (q) sp.set('q', q);
    try {
      const d = await apiGet<{ lots: Lot[] }>(`/api/inventory?${sp}`);
      setLots(d.lots);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [status, skuId, q]);

  useEffect(() => {
    apiGet<{ skus: Sku[] }>('/api/masters')
      .then((d) => setSkus(d.skus))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="在庫一覧"
        lead="期限の早い順に表示します。隔離中のロットは引当・ピッキングの対象になりません。"
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">すべての状態</option>
          {Object.entries(LOT_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select className={inputClass} value={skuId} onChange={(e) => setSkuId(e.target.value)}>
          <option value="">すべての SKU</option>
          {skus.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
        <input
          className={`${inputClass} sm:col-span-2`}
          placeholder="ロット番号で絞り込み"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {error && <div className="mb-4"><Alert tone="bad" title="読み込みに失敗しました">{error}</Alert></div>}

      <Card>
        {!lots ? (
          <Empty>読み込み中…</Empty>
        ) : lots.length === 0 ? (
          <Empty>条件に合うロットがありません。</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-4">ロット</th>
                  <th className="py-2 pr-4">SKU</th>
                  <th className="py-2 pr-4">温度帯</th>
                  <th className="py-2 pr-4 text-right">数量</th>
                  <th className="py-2 pr-4">期限</th>
                  <th className="py-2 pr-4">実測温度</th>
                  <th className="py-2 pr-4">位置</th>
                  <th className="py-2">状態</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 align-top last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{l.lot_code}</td>
                    <td className="py-2 pr-4">
                      {l.skus?.name}
                      <span className="block text-xs text-slate-400">{l.skus?.code}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <Badge tone="info">{TEMP_BAND_LABEL[l.skus?.temp_band as TempBand]}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{l.qty}</td>
                    <td className="py-2 pr-4 tabular-nums">{l.expiry_date}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {l.measured_temp === null ? '—' : `${l.measured_temp}°C`}
                    </td>
                    <td className="py-2 pr-4">{l.location ?? '—'}</td>
                    <td className="py-2">
                      <Badge tone={STATUS_TONE[l.status]}>{LOT_STATUS_LABEL[l.status]}</Badge>
                      {l.quarantine_reason && (
                        <span className="mt-1 block max-w-56 text-xs text-rose-700">
                          {l.quarantine_reason}
                        </span>
                      )}
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

export default function InventoryPage() {
  return (
    <Suspense fallback={<Empty>読み込み中…</Empty>}>
      <InventoryView />
    </Suspense>
  );
}
