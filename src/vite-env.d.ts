/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    settings?: {
      getCompanyName: () => Promise<{ company_name: string }>;
      setCompanyName: (company_name: string) => Promise<{ ok: boolean; company_name: string }>;
    };
    db: { init: () => Promise<unknown>; seed: () => Promise<unknown> };
    items: {
      list: (activeOnly?: boolean) => Promise<Item[]>;
      search: (q: string) => Promise<Item[]>;
      create: (row: { name: string; unit: string; min_stock?: number }) => Promise<{ id: number }>;
      update: (id: number, row: Partial<Item & { spec_default?: string; category_id?: number | null }>) => Promise<any>;
    };
    stocks: {
      list: (query?: string) => Promise<StockRow[]>;
      alerts: () => Promise<any[]>;
      itemDetail: (itemId: number) => Promise<ItemDetailResponse>;
      itemMoves: (itemId: number, limit?: number) => Promise<any[]>;
    };
    operators: { list: () => Promise<{ name: string }[]>; add: (name: string) => Promise<{ ok: boolean }> };
    movements: {
      in: (row: MovementInRow) => Promise<{ ok: boolean }>;
      out: (row: MovementOutRow) => Promise<{ ok: boolean }>;
      recent: (limit: number) => Promise<MovementRow[]>;
    };
    claims: {
      list: () => Promise<Claim[]>;
      get: (id: number) => Promise<ClaimDetail | null>;
      create: (row: ClaimCreateRow) => Promise<{ id: number }>;
      updateStatus: (id: number, status: string) => Promise<{ ok: boolean }>;
      itemsByClaim: (claimId: number) => Promise<ClaimItemRow[]>;
      forInbound: () => Promise<Claim[]>;
    };
    categories: {
      list: () => Promise<{ id: number; name: string }[]>;
      create: (name: string) => Promise<{ id: number; name: string }>;
    };
    reports: {
      daily: (start: string, end: string, itemId?: number, operator?: string) => Promise<DailyRow[]>;
      topItems: (start: string, end: string, type: string, limit: number) => Promise<TopItemRow[]>;
      movements: (start: string, end: string, itemId?: number, operator?: string) => Promise<MovementRow[]>;
    };
    dbBackup: { export: () => Promise<ArrayBuffer>; import: (buffer: ArrayBuffer) => Promise<{ ok: boolean }> };
  };
}

interface Item {
  id: number;
  name: string;
  unit: string;
  min_stock: number;
  is_active: number;
  category_id?: number | null;
  spec?: string;
  created_at: string;
}

interface ItemDetailResponse {
  item: { id: number; name: string; spec: string | null; unit: string; category_name: string | null };
  stock: { qty: number; updated_at?: string };
  last_inbound_at: string | null;
  outbounds: Array<{
    doc_id: number | null;
    doc_no: string | null;
    biz_date: string;
    occurred_at: string;
    qty: number;
    operator_name: string | null;
    remark: string | null;
  }>;
}

interface StockRow {
  item_id: number;
  qty: number;
  updated_at: string;
  name: string;
  unit: string;
  min_stock: number;
  is_active: number;
  spec?: string;
  category_name?: string;
  last_in_date?: string | null;
}

interface MovementInRow {
  item_id: number;
  qty: number;
  biz_date: string;
  operator: string;
  note?: string;
  claim_id?: number;
  category_id?: number | null;
}

interface MovementOutRow {
  item_id: number;
  qty: number;
  biz_date: string;
  operator: string;
  note?: string;
}

interface MovementRow {
  id: number;
  type: string;
  item_id: number;
  qty: number;
  biz_date: string;
  operator: string;
  note: string | null;
  claim_id: number | null;
  created_at: string;
  item_name: string;
  unit: string;
}

interface Claim {
  id: number;
  claim_no: string;
  biz_date: string;
  requester: string;
  status: string;
  note: string | null;
  created_at: string;
}

interface ClaimDetail extends Claim {
  items: ClaimItemRow[];
}

interface ClaimItemRow {
  id: number;
  claim_id: number;
  item_id: number;
  requested_qty: number;
  received_qty: number;
  item_name: string;
  unit: string;
  item_spec?: string;
  category_name?: string;
  remark?: string;
}

interface ClaimCreateRow {
  claim_no: string;
  biz_date: string;
  requester: string;
  status?: string;
  note?: string;
  items?: { item_id: number; requested_qty: number }[];
}

interface DailyRow {
  date: string;
  in_qty: number;
  out_qty: number;
}

interface TopItemRow {
  item_id: number;
  item_name: string;
  unit: string;
  total_qty: number;
}
