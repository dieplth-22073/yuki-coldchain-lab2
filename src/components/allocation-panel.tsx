'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiSend } from '@/lib/fetcher';
import { Alert, Badge, Card, Empty, Field, inputClass } from '@/components/ui';
import type { AllocationPlan } from '@/lib/allocation';
import type { Lot, Order } from '@/lib/types';

type PlanResponse = {
  order: Order;
  plan: AllocationPlan;
  availableLots: Lot[];
  deliveredExpiries: string[];
};

export function AllocationPanel({
  orderId,
  onDone,
}: {
  orderId: string;
  /** 受注一覧を取り直す。完了を待ってから busy を解除する。 */
  onDone: () => void | Promise<void>;
}) {
  const [data, setData] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setDone(null);
    setError(null);
    setReason('');
    apiGet<PlanResponse>(`/api/orders/${orderId}/plan`)
      .then((d) => {
        setData(d);
        setChosen(d.plan.candidate?.id ?? null);
      })
      .catch((e) => setError(e.message));
  }, [orderId]);

  if (error) return <Alert tone="bad" title="引当計画を取得できません">{error}</Alert>;
  if (!data) return <Empty>計算中…</Empty>;

  const { plan, order } = data;
  const chosenLot = data.availableLots.find((l) => l.id === chosen) ?? null;
  // 選び直した場合も、その場で逆転判定をやり直す
  const chosenViolates =
    chosenLot && plan.reversal?.lastDeliveredExpiry
      ? chosenLot.expiry_date < plan.reversal.lastDeliveredExpiry
      : false;

  async function allocate() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiSend<{ overridden: boolean }>(`/api/orders/${orderId}/allocate`, {
        lot_id: chosen,
        override: chosenViolates,
        reason: chosenViolates ? reason : undefined,
      });
      setDone(
        r.overridden
          ? '日付逆転を承知のうえで引き当てました。逸脱として記録しています。'
          : '引当が完了しました。',
      );
      await onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={`引当 — ${order.order_code}`}>
      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <dt className="text-slate-500">顧客</dt>
        <dd className="font-medium">{order.customers?.name}</dd>
        <dt className="text-slate-500">SKU</dt>
        <dd className="font-medium">{order.skus?.name}</dd>
        <dt className="text-slate-500">要求数量</dt>
        <dd className="font-medium tabular-nums">{order.qty}</dd>
        <dt className="text-slate-500">希望日</dt>
        <dd className="font-medium tabular-nums">{order.requested_date}</dd>
      </dl>

      {error && <div className="mb-4"><Alert tone="bad" title="引当できませんでした">{error}</Alert></div>}

      {/* 引当後に古い候補一覧と警告を出したままにすると、完了したのか未完了なのか読めなくなる */}
      {done ? (
        <Alert tone="good" title={done}>
          この受注は「引当済」になりました。出荷前チェックへ進めます。
        </Alert>
      ) : plan.blockedReason ? (
        <Alert tone="bad" title="引当できません">{plan.blockedReason}</Alert>
      ) : (
        <>
          {plan.reversal?.violated ? (
            <Alert tone="bad" title="⚠ 日付逆転禁止に抵触します">
              この顧客にはすでに <b>{plan.reversal.lastDeliveredExpiry}</b> の期限で納品済みです。
              FEFO 先頭の <b>{plan.reversal.candidateExpiry}</b> はそれより古いため、
              そのまま出荷すると日付逆転になります。
              {plan.alternatives.length > 0 && (
                <p className="mt-2">
                  逆転しない代替ロットが {plan.alternatives.length} 件あります。下の一覧から選び直せます。
                </p>
              )}
            </Alert>
          ) : (
            <Alert tone="good" title="日付逆転なし">{plan.reversal?.message}</Alert>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-3"></th>
                  <th className="py-2 pr-4">ロット</th>
                  <th className="py-2 pr-4">期限</th>
                  <th className="py-2 pr-4 text-right">在庫</th>
                  <th className="py-2">判定</th>
                </tr>
              </thead>
              <tbody>
                {data.availableLots
                  .slice()
                  .sort((a, b) => (a.expiry_date < b.expiry_date ? -1 : 1))
                  .map((l, i) => {
                    const violates = plan.reversal?.lastDeliveredExpiry
                      ? l.expiry_date < plan.reversal.lastDeliveredExpiry
                      : false;
                    const short = l.qty < order.qty;
                    return (
                      <tr key={l.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3">
                          <input
                            type="radio"
                            name="lot"
                            checked={chosen === l.id}
                            disabled={short || !!done}
                            onChange={() => setChosen(l.id)}
                          />
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {l.lot_code}
                          {i === 0 && <Badge tone="info">FEFO 先頭</Badge>}
                        </td>
                        <td className="py-2 pr-4 tabular-nums">{l.expiry_date}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{l.qty}</td>
                        <td className="py-2">
                          {short ? (
                            <Badge tone="neutral">数量不足</Badge>
                          ) : violates ? (
                            <Badge tone="bad">日付逆転</Badge>
                          ) : (
                            <Badge tone="good">引当可</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {chosenViolates && !done && (
            <div className="mt-4">
              <Field
                label="日付逆転を承知で引き当てる理由（必須）"
                hint="入力した理由は逸脱として記録に残ります。理由がないと保存できません。"
              >
                <input
                  className={inputClass}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="例: 顧客合意済みのため"
                />
              </Field>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={allocate}
              disabled={busy || !chosen || !!done || (chosenViolates && !reason.trim())}
              className={`rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                chosenViolates ? 'bg-rose-700 hover:bg-rose-800' : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              {busy ? '引当中…' : chosenViolates ? '逆転を承知で引き当てる' : '引き当てる'}
            </button>
            {chosenViolates && !reason.trim() && (
              <span className="text-xs text-rose-700">理由を入力すると実行できます。</span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
