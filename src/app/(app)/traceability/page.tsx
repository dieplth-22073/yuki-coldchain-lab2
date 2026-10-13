'use client';

import { useState } from 'react';
import { apiGet } from '@/lib/fetcher';
import { Alert, Badge, Card, Empty, PageHeader, inputClass } from '@/components/ui';
import { LOT_STATUS_LABEL, type Lot } from '@/lib/types';

type Link = {
  id: string;
  qty: number;
  allocated_at: string;
  lots?: { lot_code: string; expiry_date: string };
  orders?: { order_code: string; status: string; customers?: { code: string; name: string } };
};

type Result = { lane: string; query: string; lots: Lot[]; links: Link[]; note: string | null };

const LANES = [
  { key: 'lot', label: '社内ロット番号', placeholder: 'LOT-2601' },
  { key: 'rice', label: '米産地', placeholder: '秋田県' },
  { key: 'cattle', label: '牛個体識別番号', placeholder: '1234567890' },
];

export default function TraceabilityPage() {
  const [lane, setLane] = useState('lot');
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setRes(null);
    try {
      setRes(await apiGet<Result>(`/api/traceability?lane=${lane}&q=${encodeURIComponent(q)}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const current = LANES.find((l) => l.key === lane)!;

  return (
    <>
      <PageHeader
        title="トレーサビリティ検索"
        lead="米産地・牛個体識別番号・社内ロットの三レーンで追跡します。記録が無い部分は推測で埋めず、「ここで記録が途切れる」と明示します。"
      />

      <div className="mb-6">
        <Card>
          <form onSubmit={search} className="flex flex-wrap items-end gap-3">
            <div className="min-w-48">
              <span className="mb-1 block text-xs font-medium text-slate-700">検索レーン</span>
              <select className={inputClass} value={lane} onChange={(e) => setLane(e.target.value)}>
                {LANES.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-64 flex-1">
              <span className="mb-1 block text-xs font-medium text-slate-700">キーワード</span>
              <input
                className={inputClass}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={current.placeholder}
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? '検索中…' : '検索'}
            </button>
          </form>
        </Card>
      </div>

      {error && <div className="mb-4"><Alert tone="bad" title="検索に失敗しました">{error}</Alert></div>}

      {res && (
        <div className="space-y-6">
          {res.note && <Alert tone="info" title="記録の終端">{res.note}</Alert>}

          <Card title={`該当ロット（${res.lots.length} 件）`}>
            {res.lots.length === 0 ? (
              <Empty>該当なし</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="py-2 pr-4">ロット</th>
                      <th className="py-2 pr-4">SKU</th>
                      <th className="py-2 pr-4">仕入先</th>
                      <th className="py-2 pr-4">米産地</th>
                      <th className="py-2 pr-4">個体識別番号</th>
                      <th className="py-2 pr-4">期限</th>
                      <th className="py-2">状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.lots.map((l) => (
                      <tr key={l.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs">{l.lot_code}</td>
                        <td className="py-2 pr-4">{l.skus?.name}</td>
                        <td className="py-2 pr-4">{l.suppliers?.name}</td>
                        <td className="py-2 pr-4">{l.rice_origin ?? '—'}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{l.cattle_id ?? '—'}</td>
                        <td className="py-2 pr-4 tabular-nums">{l.expiry_date}</td>
                        <td className="py-2">
                          <Badge tone={l.status === 'available' ? 'good' : 'bad'}>
                            {LOT_STATUS_LABEL[l.status]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title={`配送先までの追跡（${res.links.length} 件）`}>
            {res.links.length === 0 ? (
              <Empty>このロットから先の配送記録はありません。</Empty>
            ) : (
              <ul className="space-y-3">
                {res.links.map((k) => (
                  <li key={k.id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3 text-sm last:border-0">
                    <span className="font-mono text-xs">{k.lots?.lot_code}</span>
                    <span className="text-slate-400">→</span>
                    <span className="font-mono text-xs">{k.orders?.order_code}</span>
                    <span className="text-slate-400">→</span>
                    <span className="font-medium">{k.orders?.customers?.name}</span>
                    <Badge tone="neutral">{k.qty} 個</Badge>
                    <span className="text-xs text-slate-400">期限 {k.lots?.expiry_date}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
