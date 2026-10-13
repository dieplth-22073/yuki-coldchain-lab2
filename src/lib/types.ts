export type TempBand = 'ambient' | 'chilled' | 'frozen';
export type ExpiryType = 'best_before' | 'use_by';
export type LotStatus = 'available' | 'quarantined' | 'released' | 'disposed';
export type OrderStatus = 'created' | 'allocated' | 'dispatched' | 'delivered';
export type DeliveryCondition = 'curbside' | 'doorstep';

export const TEMP_BAND_LABEL: Record<TempBand, string> = {
  ambient: '常温',
  chilled: '冷蔵',
  frozen: '冷凍',
};

export const EXPIRY_TYPE_LABEL: Record<ExpiryType, string> = {
  best_before: '賞味期限',
  use_by: '消費期限',
};

export const LOT_STATUS_LABEL: Record<LotStatus, string> = {
  available: '利用可能',
  quarantined: '隔離',
  released: 'リリース済',
  disposed: '廃棄',
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  created: '未引当',
  allocated: '引当済',
  dispatched: '出荷済',
  delivered: '納品済',
};

export const DELIVERY_CONDITION_LABEL: Record<DeliveryCondition, string> = {
  curbside: '車上渡し',
  doorstep: '軒先渡し',
};

export type Sku = {
  id: string;
  code: string;
  name: string;
  temp_band: TempBand;
  expiry_type: ExpiryType;
};

export type Supplier = { id: string; code: string; name: string };
export type Customer = { id: string; code: string; name: string };

export type Lot = {
  id: string;
  lot_code: string;
  sku_id: string;
  supplier_id: string;
  qty: number;
  expiry_date: string;
  received_at: string;
  measured_temp: number | null;
  status: LotStatus;
  quarantine_reason: string | null;
  location: string | null;
  rice_origin: string | null;
  cattle_id: string | null;
  skus?: Sku | null;
  suppliers?: Supplier | null;
};

export type Order = {
  id: string;
  order_code: string;
  customer_id: string;
  sku_id: string;
  qty: number;
  requested_date: string;
  delivery_condition: DeliveryCondition;
  status: OrderStatus;
  created_at: string;
  customers?: Customer | null;
  skus?: Sku | null;
};

export type TempThreshold = {
  temp_band: TempBand;
  min_c: number;
  max_c: number;
  version: string;
};
