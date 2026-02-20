// HTTP API 客户端，替代 electronAPI
const API_BASE = 'http://127.0.0.1:41731/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const hasBody = options?.body !== undefined && options?.body !== null;
  const headers: HeadersInit = {
      ...options?.headers,
  };
  // 只有在有 body 时才设置 Content-Type
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
    if (!response.ok) {
      const text = await response.text();
      let payload: { error?: string; message?: string; existingId?: number } | null = null;
      try {
        payload = JSON.parse(text);
      } catch (_) {
        // ignore
      }
      const err: any = new Error(payload?.message || `API Error: ${response.status} ${text}`);
      err.status = response.status;
      err.payload = payload;
      throw err;
    }
    return response.json();
  } catch (e: any) {
    // 捕获网络错误并翻译
    if (e?.message?.includes('NetworkError') || e?.message?.includes('fetch') || e?.name === 'TypeError') {
      const networkErr: any = new Error('网络连接失败，请检查后端服务是否正常运行（http://127.0.0.1:41731）');
      networkErr.originalError = e;
      throw networkErr;
    }
    throw e;
  }
}

export const api = {
  settings: {
    getCompanyName: () => request<{ company_name: string }>('/settings/company_name'),
    setCompanyName: (company_name: string) =>
      request<{ ok: boolean; company_name: string }>('/settings/company_name', {
        method: 'POST',
        body: JSON.stringify({ company_name }),
      }),
  },
  db: {
    init: () => request<{ ok: boolean }>('/db/init', { 
      method: 'POST', 
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' }
    }),
    seed: () => request<{ ok: boolean }>('/db/seed', { 
      method: 'POST', 
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' }
    }),
  },
  categories: {
    list: () => request<{ id: number; name: string }[]>('/categories'),
    create: (name: string) =>
      request<{ id: number; name: string } | { error: string; existingId: number }>('/categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
  },
  items: {
    list: (activeOnly?: boolean) => request<any[]>(`/items${activeOnly ? '?activeOnly=true' : ''}`),
    search: (q: string) => request<any[]>(`/v2/items/search?q=${encodeURIComponent(q)}`),
    create: (row: { name: string; unit: string; min_stock?: number; is_active?: number }) =>
      request<{ id: number }>('/items', {
        method: 'POST',
        body: JSON.stringify(row),
      }),
    update: (id: number, row: Partial<{ name: string; unit: string; min_stock: number; is_active: number; category_id?: number | null; spec_default?: string }>) =>
      request<any>(`/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify(row),
      }),
  },
  stocks: {
    list: (query?: string) => request<any[]>(query || '/stocks'),
    alerts: () => request<any[]>('/stocks/alerts'),
    itemDetail: (itemId: number) => request<any>(`/stocks/item-detail?item_id=${itemId}`),
    itemMoves: (itemId: number, limit?: number) =>
      request<any[]>(`/v2/items/${itemId}/moves${limit ? `?limit=${limit}` : ''}`),
  },
  operators: {
    list: () => request<{ name: string }[]>('/operators'),
    add: (name: string) =>
      request<{ ok: boolean }>('/operators', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
  },
  movements: {
    in: (row: {
      item_id: number;
      qty: number;
      biz_date: string;
      operator: string;
      note?: string;
      claim_id?: number;
      category_id?: number | null;
    }) =>
      request<{ ok: boolean }>('/movements/in', {
        method: 'POST',
        body: JSON.stringify(row),
      }),
    out: (row: { item_id: number; qty: number; biz_date: string; operator: string; note?: string }) =>
      request<{ ok: boolean }>('/movements/out', {
        method: 'POST',
        body: JSON.stringify(row),
      }),
    recent: (limit: number) => request<any[]>(`/movements/recent?limit=${limit}`),
  },
  claims: {
    list: (sortBy?: string, sortOrder?: string) =>
      request<any[]>(`/claims${sortBy != null ? `?sortBy=${encodeURIComponent(sortBy)}&sortOrder=${encodeURIComponent(sortOrder || 'desc')}` : ''}`),
    get: (id: number) => request<any>(`/claims/${id}`),
    create: (row: {
      claim_no: string;
      biz_date: string;
      requester: string;
      status?: string;
      note?: string;
      items?: { item_id: number; requested_qty: number }[];
    }) =>
      request<{ id: number }>('/claims', {
        method: 'POST',
        body: JSON.stringify(row),
      }),
    updateStatus: (id: number, status: string) =>
      request<{ ok: boolean }>(`/claims/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    itemsByClaim: (claimId: number) => request<any[]>(`/claims/${claimId}/items`),
    forInbound: () => request<any[]>('/claims/for-inbound'),
  },
  reports: {
    daily: (start: string, end: string, itemId?: number, operator?: string) => {
      const params = new URLSearchParams({ start, end });
      if (itemId) params.append('itemId', String(itemId));
      if (operator) params.append('operator', operator);
      return request<any[]>(`/reports/daily?${params}`);
    },
    topItems: (start: string, end: string, type: string, limit: number) =>
      request<any[]>(`/reports/top-items?start=${start}&end=${end}&type=${type}&limit=${limit}`),
    movements: (start: string, end: string, itemId?: number, operator?: string) => {
      const params = new URLSearchParams({ start, end });
      if (itemId) params.append('itemId', String(itemId));
      if (operator) params.append('operator', operator);
      return request<any[]>(`/reports/movements?${params}`);
    },
  },
  dbBackup: {
    export: async (): Promise<ArrayBuffer> => {
      const response = await fetch(`${API_BASE}/db/export`);
      if (!response.ok) throw new Error('Export failed');
      return response.arrayBuffer();
    },
    import: async (buffer: ArrayBuffer): Promise<{ ok: boolean }> => {
      const formData = new FormData();
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      formData.append('file', blob, 'warehouse-backup.db');
      const response = await fetch(`${API_BASE}/db/import`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Import failed');
      return response.json();
    },
  },
};

// 兼容 electronAPI 接口
declare global {
  interface Window {
    electronAPI?: typeof api;
    api: typeof api;
  }
}

// 在 Web 模式下，将 api 挂载到 window
if (typeof window !== 'undefined') {
  window.api = api;
  // 如果没有 electronAPI，使用 api 作为 fallback
  if (!window.electronAPI) {
    window.electronAPI = api as any;
  }
}

export default api;
