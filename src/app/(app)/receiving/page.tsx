'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiSend } from '@/lib/fetcher';
import { Alert, Card, Field, PageHeader, inputClass } from '@/components/ui';
import {
  EXPIRY_TYPE_LABEL,
  TEMP_BAND_LABEL,
  type Sku,
  type Supplier,
  type TempThreshold,
} from '@/lib/types';

type Masters = { skus: Sku[]; suppliers: Supplier[]; thresholds: TempThreshold[] };

export default function ReceivingPage() {
  const [m, setM] = useState<Masters | null>(null);
  const [form, setForm] = useState({
    lot_code: '',
    sku_id: '',
    supplier_id: '',
    qty: '',
    expiry_date: '',
    measured_temp: '',
    location: '',
  });
  const [result, setResult] = useState<{ quarantined: boolean; reason: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiGet<Masters>('/api/masters')
      .then((d) => {
        setM(d);
        setForm((f) => ({
          ...f,
          sku_id: d.skus[0]?.id ?? '',
          supplier_id: d.suppliers[0]?.id ?? '',
          lot_code: `LOT-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(
            Math.floor(Math.random() * 900 + 100),
          )}`,
        }));
      })
      .catch((e) => setError(e.message));
  }, []);

  const sku = m?.skus.find((s) => s.id === form.sku_id);
  const th = m?.thresholds.find((t) => t.temp_band === sku?.temp_band);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await apiSend<{ quarantined: boolean; reason: string | null }>('/api/lots', {
        ...form,
        qty: Number(form.qty),
        measured_temp: form.measured_temp === '' ? undefined : Number(form.measured_temp),
      });
      setResult({ quarantined: r.quarantined, reason: r.reason });
      setForm((f) => ({ ...f, lot_code: '', qty: '', measured_temp: '' }));
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
        title="入荷・検品"
        lead="受入時の実測温度が温度帯の閾値を外れていると、保存した時点で自動的に隔離になります。閾値はコードではなく temp_thresholds テーブルから読んでいます。"
      />

      {error && <div className="mb-4"><Alert tone="bad" title="登録できませんでした">{error}</Alert></div>}

      {result && (
        <div className="mb-4">
          {result.quarantined ? (
            <Alert tone="bad" title="隔離として登録しました">
              {result.reason}
              <br />
              このロットは引当・ピッキングの対象外になります。
            </Alert>
          ) : (
            <Alert tone="good" title="利用可能として登録しました">
              検査に合格したため、在庫として引当可能です。
            </Alert>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="入荷検査記録">
            <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
              <Field label="ロット番号">
                <input required className={inputClass} value={form.lot_code} onChange={set('lot_code')} />
              </Field>
              <Field label="入荷位置">
                <input className={inputClass} value={form.location} onChange={set('location')} placeholder="A-01" />
              </Field>
              <Field label="SKU">
                <select required className={inputClass} value={form.sku_id} onChange={set('sku_id')}>
                  {m?.skus.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="仕入先">
                <select required className={inputClass} value={form.supplier_id} onChange={set('supplier_id')}>
                  {m?.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="数量">
                <input required type="number" min={1} className={inputClass} value={form.qty} onChange={set('qty')} />
              </Field>
              <Field
                label={sku ? EXPIRY_TYPE_LABEL[sku.expiry_type] : '期限'}
                hint={sku ? `この SKU は ${EXPIRY_TYPE_LABEL[sku.expiry_type]} 管理です` : undefined}
              >
                <input required type="date" className={inputClass} value={form.expiry_date} onChange={set('expiry_date')} />
              </Field>
              <Field
                label="実測温度 (°C)"
                hint={th ? `許容範囲 ${th.min_c}〜${th.max_c}°C (閾値版 ${th.version})` : undefined}
              >
                <input type="number" step="0.1" className={inputClass} value={form.measured_temp} onChange={set('measured_temp')} />
              </Field>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={busy || !m}
                  className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy ? '登録中…' : '検査結果を登録'}
                </button>
              </div>
            </form>
          </Card>
        </div>

        <Card title="温度帯の閾値（ルール版）">
          <ul className="space-y-2 text-sm">
            {m?.thresholds.map((t) => (
              <li key={t.temp_band} className="flex justify-between border-b border-slate-100 pb-2 last:border-0">
                <span>{TEMP_BAND_LABEL[t.temp_band]}</span>
                <span className="tabular-nums text-slate-600">
                  {t.min_c}〜{t.max_c}°C
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            値を変えるとコード修正なしで判定が変わります。
          </p>
        </Card>
      </div>
    </>
  );
}
