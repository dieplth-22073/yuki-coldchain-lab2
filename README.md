# 食品コールドチェーン業務支援システム — プロトタイプ (LAB-2)

ユキコールドロジスティクス様向け提案 (LAB-1) の画面・機能一覧をもとに作った、
実際に動くプロトタイプです。Next.js + Supabase + Vercel。

| | |
|---|---|
| デプロイ URL | **https://yuki-coldchain-lab2.vercel.app** |
| Supabase プロジェクト | https://kzdbvxeqgowlafgumnya.supabase.co |
| リポジトリ | https://github.com/dieplth-22073/yuki-coldchain-lab2 |

---

## デモ用アカウント

レビューのため、**LAB-6 終了まで有効なまま**にしておきます。

| メールアドレス | パスワード |
|---|---|
| `demo@example.com` | `ColdChain2026!` |

> アカウントは Supabase ダッシュボードの **Authentication → Users → Add user** で作成します。
> 作成時に **Auto Confirm User** を有効にしてください（メール確認を省略するため）。

---

## ⚠️ DB 接続エラーが出たら — Resume project

Supabase の無料プランは、**しばらくアクセスが無いとプロジェクトが自動的に一時停止** します。
停止中はアプリが「取得に失敗しました」と表示します。

その場合は次の手順で復帰してください。

1. [Supabase ダッシュボード](https://supabase.com/dashboard) を開く
2. 対象プロジェクトを選ぶ
3. **「Resume project」** ボタンを押す
4. 1〜2 分待ってからアプリを再読み込みする

このアプリは接続エラーを検知すると、画面のエラーメッセージ自体に
「Resume project を押してください」と出すようにしてあります。

---

## ローカルでの動かし方

```bash
npm install
cp .env.local.example .env.local   # 値を自分の Supabase のものに差し替える
npm run dev                        # http://localhost:3000
```

`.env.local` に入れる 2 つの値は、Supabase の **Project Settings → API** にあります。

| 変数 | どこの値か |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project API keys の `anon` `public` |

### DB の準備（初回のみ）

Supabase の **SQL Editor** で、この順に実行します。

1. `supabase/schema.sql` — テーブル・制約・RLS
2. `supabase/seed.sql` — サンプルデータ

`seed.sql` は冒頭で `truncate` するので、何度流しても同じ状態に戻ります。

---

## そのほかのコマンド

```bash
npm test          # 引当ロジック（FEFO・日付逆転禁止）の単体テスト
npm run build     # 本番ビルド
npx eslint .      # Lint
```

---

## 画面構成

| 画面 | パス | 役割 |
|---|---|---|
| ログイン | `/login` | Supabase Auth。未ログインでは他の画面に入れない |
| ダッシュボード | `/` | 在庫・受注・逸脱の件数、期限が近いロット |
| 入荷・検品 | `/receiving` | 実測温度が閾値外なら自動で隔離 |
| 在庫一覧 | `/inventory` | 期限順。状態・SKU・ロット番号で絞り込み |
| 受注・引当 | `/orders` | **FEFO 引当と日付逆転禁止の警告** |
| 出荷前チェック | `/predispatch` | 温度逸脱時は出荷をブロック |
| トレーサビリティ | `/traceability` | 米産地・牛個体識別番号・社内ロットの三レーン検索 |

機能の詳細と「どこをモックにしたか」は [`docs/screen-feature-list.md`](docs/screen-feature-list.md) を参照してください。

---

## ログインゲートについて

二重にかけています。

1. **`src/middleware.ts`** — 未ログインのリクエストは API ルートも含めて `/login` にリダイレクト
2. **Supabase の RLS** — 全テーブルで `authenticated` ロールのみ許可。
   anon キーを直接叩いても、ログインしていなければ 1 行も返りません

---

## 技術構成

| | |
|---|---|
| Framework | Next.js 15 (App Router) |
| 言語 | TypeScript |
| スタイル | Tailwind CSS |
| 認証・DB | Supabase (Auth + Postgres + RLS) |
| デプロイ | Vercel |

ビジネスルール（FEFO と日付逆転禁止）は `src/lib/allocation.ts` に純粋関数として切り出し、
API ルートと画面の双方から同じ判定を呼んでいます。ルールが二重に書かれないようにするためです。
