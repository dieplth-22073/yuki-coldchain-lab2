import type { Lot } from './types';

/**
 * 引当の業務ルール。DB に触らない純粋関数として切り出してある。
 * 画面・API の双方から同じ判定を使い、ルールが二重にならないようにする。
 */

export type ReversalCheck = {
  violated: boolean;
  /** 同一顧客・同一 SKU で過去に納品した期限のうち最も新しいもの */
  lastDeliveredExpiry: string | null;
  candidateExpiry: string;
  message: string;
};

/** 引当候補。FEFO で先頭に来たロットが candidate。 */
export type AllocationPlan = {
  candidate: Lot | null;
  /** 数量不足などで引き当てられない理由。null なら引当可能 */
  blockedReason: string | null;
  reversal: ReversalCheck | null;
  /** FEFO 順に並べた、日付逆転を起こさない代替ロット */
  alternatives: Lot[];
};

/**
 * FEFO (先期限先出し)。期限が早い順、同日なら入荷が早い順。
 * BR-FEFO-01 の入荷日時タイブレークに対応する。
 */
export function sortByFefo(lots: Lot[]): Lot[] {
  return [...lots].sort((a, b) => {
    if (a.expiry_date !== b.expiry_date) {
      return a.expiry_date < b.expiry_date ? -1 : 1;
    }
    return a.received_at < b.received_at ? -1 : 1;
  });
}

/**
 * 日付逆転禁止 (R-07)。
 * 同一顧客・同一 SKU について、すでに納品した期限より古い期限を後から送らない。
 */
export function checkDateReversal(
  candidateExpiry: string,
  deliveredExpiries: string[],
): ReversalCheck {
  if (deliveredExpiries.length === 0) {
    return {
      violated: false,
      lastDeliveredExpiry: null,
      candidateExpiry,
      message: '同一顧客・同一 SKU の納品実績がないため、日付逆転は発生しません。',
    };
  }

  const latest = deliveredExpiries.reduce((a, b) => (a > b ? a : b));
  const violated = candidateExpiry < latest;

  return {
    violated,
    lastDeliveredExpiry: latest,
    candidateExpiry,
    message: violated
      ? `納品済みの期限 ${latest} より古い ${candidateExpiry} を引き当てようとしています。日付逆転禁止に抵触します。`
      : `納品済みの最新期限は ${latest} です。${candidateExpiry} は逆転しません。`,
  };
}

/**
 * 引当計画を立てる。隔離中のロットは呼び出し側で除外しておくこと。
 */
export function planAllocation(
  availableLots: Lot[],
  requiredQty: number,
  deliveredExpiries: string[],
): AllocationPlan {
  const fefo = sortByFefo(availableLots);
  const enough = fefo.filter((l) => l.qty >= requiredQty);

  if (fefo.length === 0) {
    return {
      candidate: null,
      blockedReason: '利用可能なロットがありません。',
      reversal: null,
      alternatives: [],
    };
  }

  if (enough.length === 0) {
    return {
      candidate: null,
      blockedReason: `要求数量 ${requiredQty} を単一ロットで満たせません (最大 ${Math.max(
        ...fefo.map((l) => l.qty),
      )})。本プロトタイプは分割引当に未対応です。`,
      reversal: null,
      alternatives: [],
    };
  }

  const candidate = enough[0];
  const reversal = checkDateReversal(candidate.expiry_date, deliveredExpiries);

  const alternatives = reversal.violated
    ? enough.filter(
        (l) =>
          l.id !== candidate.id &&
          !checkDateReversal(l.expiry_date, deliveredExpiries).violated,
      )
    : [];

  return { candidate, blockedReason: null, reversal, alternatives };
}
