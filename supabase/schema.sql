-- ============================================================
-- LAB-2 食品コールドチェーン業務支援システム — スキーマ
-- Supabase SQL Editor にこのファイルを貼り付けて実行してください。
-- 実行後、seed.sql を実行してサンプルデータを投入します。
-- ============================================================

-- 冪等に作り直せるよう、依存の深い順に削除
drop table if exists predispatch_checks cascade;
drop table if exists deviations        cascade;
drop table if exists delivery_history  cascade;
drop table if exists allocations       cascade;
drop table if exists orders            cascade;
drop table if exists lots              cascade;
drop table if exists temp_thresholds   cascade;
drop table if exists customers         cascade;
drop table if exists suppliers         cascade;
drop table if exists skus              cascade;

-- ------------------------------------------------------------
-- マスター
-- ------------------------------------------------------------
create table skus (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  -- 三温度帯: 常温 / 冷蔵 / 冷凍
  temp_band   text not null check (temp_band in ('ambient', 'chilled', 'frozen')),
  -- 賞味期限 (品質境界) / 消費期限 (安全境界)
  expiry_type text not null check (expiry_type in ('best_before', 'use_by')),
  created_at  timestamptz not null default now()
);

create table suppliers (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  name       text not null,
  created_at timestamptz not null default now()
);

create table customers (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  name       text not null,
  created_at timestamptz not null default now()
);

-- 温度帯ごとの閾値。ルール版データとして外出しし、コード側に数値を埋め込まない
create table temp_thresholds (
  id         uuid primary key default gen_random_uuid(),
  temp_band  text unique not null check (temp_band in ('ambient', 'chilled', 'frozen')),
  min_c      numeric not null,
  max_c      numeric not null,
  version    text not null default 'v1',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 入荷・ロット
-- ------------------------------------------------------------
create table lots (
  id                uuid primary key default gen_random_uuid(),
  lot_code          text unique not null,
  sku_id            uuid not null references skus(id)      on delete restrict,
  supplier_id       uuid not null references suppliers(id) on delete restrict,
  qty               integer not null check (qty >= 0),
  expiry_date       date not null,
  received_at       timestamptz not null default now(),
  measured_temp     numeric,
  -- 利用可能 / 隔離 / リリース済 / 廃棄
  status            text not null default 'available'
                    check (status in ('available', 'quarantined', 'released', 'disposed')),
  quarantine_reason text,
  location          text,
  -- トレーサビリティ三レーン: 米産地 / 牛個体識別番号 / 社内ロット (lot_code)
  rice_origin       text,
  cattle_id         text
);

create index lots_sku_status_idx on lots (sku_id, status);
create index lots_expiry_idx     on lots (expiry_date);

-- ------------------------------------------------------------
-- 受注・引当
-- ------------------------------------------------------------
create table orders (
  id                 uuid primary key default gen_random_uuid(),
  order_code         text unique not null,
  customer_id        uuid not null references customers(id) on delete restrict,
  sku_id             uuid not null references skus(id)      on delete restrict,
  qty                integer not null check (qty > 0),
  requested_date     date not null,
  -- 車上渡し / 軒先渡し
  delivery_condition text not null default 'curbside'
                     check (delivery_condition in ('curbside', 'doorstep')),
  status             text not null default 'created'
                     check (status in ('created', 'allocated', 'dispatched', 'delivered')),
  created_at         timestamptz not null default now()
);

create table allocations (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null unique references orders(id) on delete cascade,
  lot_id        uuid not null references lots(id)          on delete restrict,
  qty           integer not null check (qty > 0),
  allocated_at  timestamptz not null default now(),
  -- 日付逆転を承知のうえで引き当てた場合のみ true。理由を必須とする
  reversal_override boolean not null default false,
  override_reason   text,
  constraint override_needs_reason
    check (reversal_override = false or (override_reason is not null and length(override_reason) > 0))
);

-- 日付逆転禁止の判定に使う配送実績
create table delivery_history (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete cascade,
  sku_id       uuid not null references skus(id)      on delete cascade,
  lot_id       uuid references lots(id)               on delete set null,
  expiry_date  date not null,
  delivered_at timestamptz not null default now()
);

create index delivery_history_cust_sku_idx on delivery_history (customer_id, sku_id);

-- ------------------------------------------------------------
-- 出荷前チェック・逸脱
-- ------------------------------------------------------------
create table deviations (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('temperature', 'date_reversal', 'seal')),
  ref_table  text not null,
  ref_id     uuid,
  detail     text not null,
  status     text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table predispatch_checks (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  vehicle_temp numeric not null,
  cargo_temp   numeric not null,
  seal_no      text not null,
  result       text not null check (result in ('pass', 'fail')),
  detail       text,
  deviation_id uuid references deviations(id) on delete set null,
  checked_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- RLS — ログイン済みユーザーのみ全テーブルにアクセスできる
-- 匿名ユーザーは一切読めない (ログインゲートの一部)
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'skus', 'suppliers', 'customers', 'temp_thresholds', 'lots',
    'orders', 'allocations', 'delivery_history', 'deviations', 'predispatch_checks'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t
    );
  end loop;
end $$;
