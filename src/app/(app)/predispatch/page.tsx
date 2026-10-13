'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiSend } from '@/lib/fetcher';
import { Alert, Badge, Card, Empty, Field, PageHeader, inputClass } from '@/components/ui';
import { TEMP_BAND_LABEL, type Order, type TempBand } from '@/lib/types';

type Check = {
  id: string;
  vehicle_temp: number;
  cargo_temp: number;
  seal_no: string;
  result: 'pass' | 'fail';
  detail: string | null;
  checked_at: string;
  orders?: {
    order_code: string;
    customers?: { name: string };
    skus?: { code: string; name: string; temp_band: TempBand };
  };
};

export default function PredispatchPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [form, setForm] = useState({ order_id: '', vehicle_temp: '', cargo_temp: '', seal_no: '' });
  const [msg, setMsg] = useState<{ blocked: boolean; detail: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, c] = await Promise.all([
        apiGet<{ orders: Order[] }>('/api/orders'),
        apiGet<{ checks: Check[] }>('/api/predispatch'),
      ]);
      const allocated = o.orders.filter((x) => x.status === 'allocated');
      setOrders(allocated);
      setChecks(c.checks);
      setForm((f) => ({ ...f, order_id: f.order_id || (allocated[0]?.id ?? '') }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await apiSend<{ blocked: boolean; detail: string }>('/api/predispatch', {
        order_id: form.order_id,
        vehicle_temp: Number(form.vehicle_temp),
        cargo_temp: Number(form.cargo_temp),
        seal_no: form.seal_no,
      });
      setMsg({ blocked: r.blocked, detail: r.detail });
      setForm((f) => ({ ...f, vehicle_temp: '', cargo_temp: '', seal_no: '' }));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageHeader
        title="出荷前チェック"
        lead="車両温度・貨物温度が温度帯の許容範囲を外れていると逸脱を作成し、出荷確認をブロックします。合格した受注だけが「出荷済」に進みます。"
      />

      {error && <div className="mb-4"><Alert tone="bad" title="処理できませんでした">{error}</Alert></div>}
      {msg && (
        <div className="mb-4">
          {msg.blocked ? (
            <Alert tone="bad" title="出荷をブロックしました">{msg.detail}</Alert>
          ) : (
            <Alert tone="good" title="合格 — 出荷済みにしました">{msg.detail}</Alert>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card title="チェック記録">
            {orders.length === 0 ? (
              <Empty>引当済みの受注がありません。先に「受注・引当」で引当してください。</Empty>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <Field label="対象の受注">
                  <select required className={inputClass} value={form.order_id} onChange={set('order_id')}>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.order_code} — {o.customers?.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="車両温度 (°C)">
                  <input required type="number" step="0.1" className={inputClass} value={form.vehicle_temp} onChange={set('vehicle_temp')} />
                </Field>
                <Field label="貨物温度 (°C)">
                  <input required type="number" step="0.1" className={inputClass} value={form.cargo_temp} onChange={set('cargo_temp')} />
                </Field>
                <Field label="シール番号">
                  <input required className={inputClass} value={form.seal_no} onChange={set('seal_no')} placeholder="SEAL-0001" />
                </Field>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy ? '記録中…' : 'チェック結果を記録'}
                </button>
              </form>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card title="チェック履歴">
            {!checks ? (
              <Empty>読み込み中…</Empty>
            ) : checks.length === 0 ? (
              <Empty>まだチェック記録がありません。</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="py-2 pr-4">受注</th>
                      <th className="py-2 pr-4">温度帯</th>
                      <th className="py-2 pr-4 text-right">車両</th>
                      <th className="py-2 pr-4 text-right">貨物</th>
                      <th className="py-2 pr-4">シール</th>
                      <th className="py-2">結果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checks.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100 align-top last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs">{c.orders?.order_code}</td>
                        <td className="py-2 pr-4">
                          {c.orders?.skus && (
                            <Badge tone="info">{TEMP_BAND_LABEL[c.orders.skus.temp_band]}</Badge>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">{c.vehicle_temp}°C</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{c.cargo_temp}°C</td>
                        <td className="py-2 pr-4 font-mono text-xs">{c.seal_no}</td>
                        <td className="py-2">
                          <Badge tone={c.result === 'pass' ? 'good' : 'bad'}>
                            {c.result === 'pass' ? '合格' : 'ブロック'}
                          </Badge>
                          {c.result === 'fail' && c.detail && (
                            <span className="mt-1 block max-w-64 text-xs text-rose-700">{c.detail}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
