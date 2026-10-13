import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDateReversal, planAllocation, sortByFefo } from './allocation.ts';
import type { Lot } from './types.ts';

function lot(p: Partial<Lot> & { id: string; expiry_date: string; qty: number }): Lot {
  return {
    lot_code: 'LOT-' + p.id,
    sku_id: 'sku',
    supplier_id: 'sup',
    received_at: '2026-10-01T00:00:00Z',
    measured_temp: null,
    status: 'available',
    quarantine_reason: null,
    location: null,
    rice_origin: null,
    cattle_id: null,
    ...p,
  } as Lot;
}

test('FEFO: 期限の早い順に並ぶ', () => {
  const sorted = sortByFefo([
    lot({ id: 'b', expiry_date: '2027-05-31', qty: 10 }),
    lot({ id: 'a', expiry_date: '2027-01-31', qty: 10 }),
  ]);
  assert.deepEqual(sorted.map((l) => l.id), ['a', 'b']);
});

test('FEFO: 同一期限は入荷が早い順 (BR-FEFO-01 のタイブレーク)', () => {
  const sorted = sortByFefo([
    lot({ id: 'late', expiry_date: '2027-01-31', qty: 10, received_at: '2026-10-05T00:00:00Z' }),
    lot({ id: 'early', expiry_date: '2027-01-31', qty: 10, received_at: '2026-09-28T00:00:00Z' }),
  ]);
  assert.deepEqual(sorted.map((l) => l.id), ['early', 'late']);
});

test('納品実績が無ければ日付逆転は起きない', () => {
  const r = checkDateReversal('2027-01-31', []);
  assert.equal(r.violated, false);
  assert.equal(r.lastDeliveredExpiry, null);
});

test('納品済みより古い期限は逆転として検出する', () => {
  const r = checkDateReversal('2027-01-31', ['2026-05-01', '2027-03-31']);
  assert.equal(r.violated, true);
  assert.equal(r.lastDeliveredExpiry, '2027-03-31');
});

test('納品済みと同一期限は逆転ではない', () => {
  const r = checkDateReversal('2027-03-31', ['2027-03-31']);
  assert.equal(r.violated, false);
});

test('シードのシナリオ: FEFO 先頭が逆転し、代替が提示される', () => {
  const plan = planAllocation(
    [
      lot({ id: '001', expiry_date: '2027-01-31', qty: 500 }),
      lot({ id: '002', expiry_date: '2027-05-31', qty: 300 }),
    ],
    100,
    ['2027-03-31'],
  );
  assert.equal(plan.candidate?.id, '001');
  assert.equal(plan.reversal?.violated, true);
  assert.deepEqual(plan.alternatives.map((l) => l.id), ['002']);
});

test('数量が足りないロットは候補にしない', () => {
  const plan = planAllocation(
    [lot({ id: 'small', expiry_date: '2027-01-31', qty: 10 })],
    100,
    [],
  );
  assert.equal(plan.candidate, null);
  assert.match(plan.blockedReason ?? '', /単一ロットで満たせません/);
});

test('在庫が無ければ引当できない', () => {
  const plan = planAllocation([], 10, []);
  assert.equal(plan.candidate, null);
  assert.match(plan.blockedReason ?? '', /利用可能なロットがありません/);
});
