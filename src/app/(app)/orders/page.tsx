'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/fetcher';
import { Alert, Badge, Card, Empty, PageHeader } from '@/components/ui';
import { AllocationPanel } from '@/components/allocation-panel';
import {
  DELIVERY_CONDITION_LABEL,
  ORDER_STATUS_LABEL,
  type Order,
  type OrderStatus,
} from '@/lib/types';

type OrderRow = Order & {
  allocations?: { lot_id: string; reversal_override: boolean; lots?: { lot_code: string; expiry_date: string } }[];
};

const TONE: Record<OrderStatus, 'warn' | 'info' | 'good' | 'neutral'> = {
  created: 'warn',
  allocated: 'info',
  dispatched: 'good',
  delivered: 'neutral',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ orders: OrderRow[] }>('/api/orders');
      setOrders(d.orders);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="受注・引当"
        lead="引当は FEFO（先期限先出し）で候補を出し、同一顧客・同一 SKU の納品実績と突き合わせて日付逆転を判定します。隔離中のロットは候補に出ません。"
      />

      {error && <div className="mb-4"><Alert tone="bad" title="読み込みに失敗しました">{error}</Alert></div>}

      <div className="mb-6">
        <Card title="受注一覧">
          {!orders ? (
            <Empty>読み込み中…</Empty>
          ) : orders.length === 0 ? (
            <Empty>受注がありません。</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-4">受注番号</th>
                    <th className="py-2 pr-4">顧客</th>
                    <th className="py-2 pr-4">SKU</th>
                    <th className="py-2 pr-4 text-right">数量</th>
                    <th className="py-2 pr-4">希望日</th>
                    <th className="py-2 pr-4">配送条件</th>
                    <th className="py-2 pr-4">状態</th>
                    <th className="py-2">引当</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const alloc = o.allocations?.[0];
                    return (
                      <tr key={o.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs">{o.order_code}</td>
                        <td className="py-2 pr-4">{o.customers?.name}</td>
                        <td className="py-2 pr-4">{o.skus?.name}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{o.qty}</td>
                        <td className="py-2 pr-4 tabular-nums">{o.requested_date}</td>
                        <td className="py-2 pr-4">
                          {DELIVERY_CONDITION_LABEL[o.delivery_condition]}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge tone={TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                        </td>
                        <td className="py-2">
                          {o.status === 'created' ? (
                            <button
                              onClick={() => setSelected(o.id)}
                              className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100"
                            >
                              引当を検討
                            </button>
                          ) : alloc ? (
                            <span className="text-xs">
                              <span className="font-mono">{alloc.lots?.lot_code}</span>
                              <span className="ml-1 text-slate-400">{alloc.lots?.expiry_date}</span>
                              {alloc.reversal_override && (
                                <Badge tone="bad">逆転承知</Badge>
                              )}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {selected && <AllocationPanel orderId={selected} onDone={load} />}
    </>
  );
}
