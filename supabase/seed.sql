-- ============================================================
-- LAB-2 サンプルデータ
-- schema.sql を実行したあとに、このファイルを実行してください。
-- 基準日は 2026-10-13 です。
--
-- ★ 日付逆転禁止のデモ用シナリオ
--   顧客 C-001 には SKU-R001 を「賞味期限 2027-03-31」で納品済み (delivery_history)。
--   在庫の FEFO 先頭は LOT-2601-001「2027-01-31」で、これより古い。
--   → ORD-26-0001 を引き当てようとすると日付逆転として検出される。
-- ============================================================

truncate predispatch_checks, deviations, delivery_history,
         allocations, orders, lots, temp_thresholds,
         customers, suppliers, skus restart identity cascade;

-- ------------------------------------------------------------
-- 閾値 (ルール版データ)
-- ------------------------------------------------------------
insert into temp_thresholds (temp_band, min_c, max_c, version) values
  ('ambient',  15,  25, 'v1'),
  ('chilled',   0,   5, 'v1'),
  ('frozen',  -60, -18, 'v1');

-- ------------------------------------------------------------
-- マスター
-- ------------------------------------------------------------
insert into suppliers (code, name) values
  ('SUP-001', '北海道農産'),
  ('SUP-002', '九州水産'),
  ('SUP-003', '関東冷凍');

insert into customers (code, name) values
  ('C-001', 'サンライズ食品'),
  ('C-002', 'みどりストア'),
  ('C-003', 'やまと物産');

insert into skus (code, name, temp_band, expiry_type) values
  ('SKU-R001', 'あきたこまち 5kg',  'ambient', 'best_before'),
  ('SKU-R002', 'こしひかり 5kg',    'ambient', 'best_before'),
  ('SKU-B001', '和牛ロース 500g',   'chilled', 'use_by'),
  ('SKU-B002', '和牛モモ 500g',     'frozen',  'use_by'),
  ('SKU-M001', '牛乳 1L',           'chilled', 'use_by'),
  ('SKU-F001', '冷凍餃子 600g',     'frozen',  'best_before');

-- ------------------------------------------------------------
-- ロット
-- ------------------------------------------------------------
insert into lots (lot_code, sku_id, supplier_id, qty, expiry_date,
                  received_at, measured_temp, status, quarantine_reason,
                  location, rice_origin, cattle_id)
select v.lot_code, s.id, sup.id, v.qty, v.expiry_date::date,
       v.received_at::timestamptz, v.measured_temp, v.status, v.quarantine_reason,
       v.location, v.rice_origin, v.cattle_id
from (values
  ('LOT-2601-001', 'SKU-R001', 'SUP-001', 500, '2027-01-31', '2026-09-28 09:10+09', 19.4, 'available',   null,                               'A-01', '秋田県大仙市', null),
  ('LOT-2601-002', 'SKU-R001', 'SUP-001', 300, '2027-05-31', '2026-10-05 08:40+09', 20.1, 'available',   null,                               'A-02', '秋田県横手市', null),
  ('LOT-2601-003', 'SKU-R002', 'SUP-001', 400, '2027-02-28', '2026-10-02 10:05+09', 18.8, 'available',   null,                               'A-03', '新潟県南魚沼市', null),
  ('LOT-2601-004', 'SKU-B001', 'SUP-002', 120, '2026-10-20', '2026-10-08 07:55+09',  2.4, 'available',   null,                               'C-01', null, '1234567890'),
  ('LOT-2601-005', 'SKU-B001', 'SUP-002',  80, '2026-11-15', '2026-10-11 07:30+09',  1.8, 'available',   null,                               'C-02', null, '1234567891'),
  ('LOT-2601-006', 'SKU-B002', 'SUP-003', 200, '2027-04-30', '2026-09-30 11:20+09', -21.0,'available',   null,                               'F-01', null, '1234567892'),
  ('LOT-2601-007', 'SKU-M001', 'SUP-003', 600, '2026-10-18', '2026-10-12 06:50+09',  3.1, 'available',   null,                               'C-03', null, null),
  ('LOT-2601-008', 'SKU-F001', 'SUP-003', 350, '2027-06-30', '2026-10-03 13:15+09', -22.5,'available',   null,                               'F-02', null, null),
  ('LOT-2601-009', 'SKU-B001', 'SUP-002',  60, '2026-10-25', '2026-10-10 08:05+09',  8.2, 'quarantined', '受入時実測温度 8.2°C が冷蔵帯 0–5°C を超過', 'Q-01', null, '1234567893'),
  ('LOT-2601-010', 'SKU-R002', 'SUP-001', 150, '2026-12-31', '2026-10-06 09:45+09', 21.0, 'quarantined', 'トレーサビリティ情報 (産地) 欠落',  'Q-02', null, null),
  ('LOT-2601-011', 'SKU-M001', 'SUP-003', 240, '2026-10-30', '2026-10-12 06:55+09',  2.9, 'available',   null,                               'C-04', null, null),
  ('LOT-2601-012', 'SKU-F001', 'SUP-003', 180, '2027-03-15', '2026-10-09 14:00+09', -19.8,'available',   null,                               'F-03', null, null)
) as v(lot_code, sku_code, sup_code, qty, expiry_date, received_at, measured_temp,
       status, quarantine_reason, location, rice_origin, cattle_id)
join skus s      on s.code   = v.sku_code
join suppliers sup on sup.code = v.sup_code;

-- ------------------------------------------------------------
-- 配送実績 (本システム稼働前の履歴。日付逆転禁止の判定に使う)
-- ------------------------------------------------------------
insert into delivery_history (customer_id, sku_id, lot_id, expiry_date, delivered_at)
select c.id, s.id, null, v.expiry_date::date, v.delivered_at::timestamptz
from (values
  ('C-001', 'SKU-R001', '2027-03-31', '2026-09-20 14:00+09'),
  ('C-001', 'SKU-M001', '2026-10-05', '2026-10-01 11:30+09'),
  ('C-002', 'SKU-B001', '2026-09-30', '2026-09-25 10:15+09')
) as v(cust_code, sku_code, expiry_date, delivered_at)
join customers c on c.code = v.cust_code
join skus s      on s.code = v.sku_code;

-- ------------------------------------------------------------
-- 受注 (未引当)
-- ------------------------------------------------------------
insert into orders (order_code, customer_id, sku_id, qty, requested_date, delivery_condition, status)
select v.order_code, c.id, s.id, v.qty, v.requested_date::date, v.delivery_condition, 'created'
from (values
  ('ORD-26-0001', 'C-001', 'SKU-R001', 100, '2026-10-20', 'curbside'),
  ('ORD-26-0002', 'C-002', 'SKU-B001',  50, '2026-10-16', 'doorstep'),
  ('ORD-26-0003', 'C-003', 'SKU-F001', 120, '2026-10-22', 'curbside'),
  ('ORD-26-0004', 'C-001', 'SKU-M001', 200, '2026-10-17', 'curbside')
) as v(order_code, cust_code, sku_code, qty, requested_date, delivery_condition)
join customers c on c.code = v.cust_code
join skus s      on s.code = v.sku_code;
