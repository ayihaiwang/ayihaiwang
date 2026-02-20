/**
 * 后端 API 路由（使用统一 v2 模型）
 * 
 * 已切换到统一数据模型：
 * - 所有数据访问通过 server/model/* 层
 * - 使用 docs_v2/doc_lines_v2/items_v2/stocks_v2/stock_moves_v2 表
 * - 兼容旧 API 接口（映射到统一模型）
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { initDb, getDbPathPublic } from './model/db';
import {
  categoriesList,
  categoryCreate,
  itemsList,
  itemCreate,
  itemUpdate,
  itemsSearch,
  operatorsList,
  operatorCreate,
  docsList,
  docGet,
  docCreate,
  docUpdate,
  docUpdateStatus,
  stocksList,
  stocksAlerts,
  stockItemDetail,
  stockMovesList,
  stockMovesRecent,
  itemMovesByItemId,
} from './model';
import {
  ensureTables,
  seed,
  reportsDaily,
  reportsTopItems,
  reportsMovements,
  exportBackup,
  importBackup,
  close,
} from './db'; // 暂时保留旧代码用于报表和备份

const fastify = Fastify({ logger: true });

// 注册 CORS
fastify.register(cors, {
  origin: true,
});

// 注册 multipart（用于文件上传）
fastify.register(multipart);

// 初始化数据库（使用统一模型层）
console.log('🚀 [Server] 启动后端服务（使用统一 v2 模型）');
initDb();
const dbPath = getDbPathPublic();
console.log(`📂 [Server] 最终数据库路径: ${dbPath}`);

// 初始化旧数据库连接（用于报表和备份功能）
import { initDb as initOldDb } from './db';
initOldDb();
console.log('📂 [Server] 旧数据库连接已初始化（用于报表和备份）');
// ensureTables(); // 已迁移到 v2，不再需要旧表初始化

// 健康检查
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// DB 初始化（已迁移到 v2，此接口仅用于兼容性）
fastify.post('/api/db/init', async () => {
  // v2 迁移已完成，表结构已存在，直接返回成功
  return { success: true, message: 'Database already initialized (v2 migration completed)' };
});

fastify.post('/api/db/seed', async () => {
  // v2 迁移已完成，seed 功能已不再需要
  return { success: true, message: 'Seed not needed (v2 migration completed)' };
});

// Categories API（新增）
fastify.get('/api/categories', async () => {
  return categoriesList();
});

fastify.post('/api/categories', async (request, reply) => {
  const { name } = request.body as { name: string };
  const result = categoryCreate(name);
  if ('error' in result) {
    reply.code(400);
    return result;
  }
  return result;
});

// Items API（使用 v2 模型）
fastify.get('/api/items', async (request) => {
  const { activeOnly } = request.query as { activeOnly?: string };
  return itemsList(activeOnly === 'true');
});

// v2 路由：moves 必须在 search 之前（避免 :id 误匹配 search）
fastify.get('/api/v2/items/:id/moves', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { limit } = request.query as { limit?: string };
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId < 1) {
    reply.status(400);
    return { error: 'VALIDATION_ERROR', message: 'item_id must be a positive integer' };
  }
  const limitNum = limit ? Math.min(Number(limit) || 200, 500) : 200;
  return itemMovesByItemId(itemId, limitNum);
});

fastify.get('/api/v2/items/search', async (request) => {
  const { q } = request.query as { q?: string };
  return itemsSearch(q ?? '');
});

fastify.post('/api/items', async (request) => {
  const body = request.body as any;
  // 映射前端字段到数据库字段：unit -> unit_default
  const unitValue = body.unit || body.unit_default;
  if (!unitValue || unitValue.trim() === '') {
    throw new Error('必填字段不能为空：单位');
  }
  const mappedBody = {
    name: body.name,
    category_id: body.category_id ?? null,
    spec_default: body.spec || body.spec_default || null,
    unit_default: unitValue.trim(),
    min_stock: body.min_stock ?? 0,
  };
  try {
    return itemCreate(mappedBody);
  } catch (e: any) {
    // 翻译数据库错误消息
    if (e?.message?.includes('NOT NULL constraint')) {
      const field = e.message.match(/\.(\w+)/)?.[1] || '字段';
      const fieldName = field === 'unit_default' ? '单位' : field === 'name' ? '物资名称' : field;
      throw new Error(`必填字段不能为空：${fieldName}`);
    }
    if (e?.message?.includes('UNIQUE constraint')) {
      throw new Error('物资名称已存在');
    }
    throw e;
  }
});

fastify.put('/api/items/:id', async (request) => {
  const { id } = request.params as { id: string };
  const body = request.body as any;
  // 映射前端字段到数据库字段：unit -> unit_default
  const mappedBody: any = {};
  if (body.name !== undefined) mappedBody.name = body.name;
  if (body.category_id !== undefined) mappedBody.category_id = body.category_id ?? null;
  if (body.spec !== undefined || body.spec_default !== undefined) {
    mappedBody.spec_default = body.spec || body.spec_default || null;
  }
  if (body.unit !== undefined || body.unit_default !== undefined) {
    mappedBody.unit_default = body.unit || body.unit_default || '';
  }
  if (body.min_stock !== undefined) mappedBody.min_stock = body.min_stock;
  if (body.is_active !== undefined) mappedBody.is_active = body.is_active;
  try {
    return itemUpdate(Number(id), mappedBody);
  } catch (e: any) {
    // 翻译数据库错误消息
    if (e?.message?.includes('NOT NULL constraint')) {
      const field = e.message.match(/\.(\w+)/)?.[1] || '字段';
      const fieldName = field === 'unit_default' ? '单位' : field === 'name' ? '物资名称' : field;
      throw new Error(`必填字段不能为空：${fieldName}`);
    }
    throw e;
  }
});

// Stocks API（使用 v2 模型）
fastify.get('/api/stocks', async (request) => {
  const query = request.query as {
    qField?: 'name' | 'spec' | 'category_name' | 'in_date';
    q?: string;
    date_from?: string;
    date_to?: string;
    sortBy?: 'name' | 'category' | 'spec' | 'qty' | 'last_in_date';
    sortOrder?: 'asc' | 'desc';
  };
  return stocksList(query);
});

fastify.get('/api/stocks/alerts', async () => {
  return stocksAlerts();
});

fastify.get('/api/stocks/item-detail', async (request, reply) => {
  const { item_id } = request.query as { item_id?: string };
  if (!item_id) {
    reply.status(400);
    return { error: 'VALIDATION_ERROR', message: 'item_id is required' };
  }
  const id = Number(item_id);
  if (!Number.isInteger(id) || id < 1) {
    reply.status(400);
    return { error: 'VALIDATION_ERROR', message: 'item_id must be a positive integer' };
  }
  try {
    const detail = stockItemDetail(id);
    if (!detail) {
      reply.status(404);
      return { error: 'NOT_FOUND', message: 'Item not found' };
    }
    return detail;
  } catch (e: any) {
    reply.status(500);
    return { error: 'SERVER_ERROR', message: e?.message || 'Internal server error' };
  }
});

// Operators API（使用 v2 模型）
fastify.get('/api/operators', async () => {
  return operatorsList();
});

fastify.post('/api/operators', async (request) => {
  const { name } = request.body as { name: string };
  return operatorCreate(name);
});

// Docs API（统一单据 API）
fastify.get('/api/docs', async (request) => {
  const query = request.query as {
    type?: 'claim' | 'inbound' | 'outbound';
    sort?: 'biz_date' | 'created_at';
    order?: 'asc' | 'desc';
  };
  return docsList(query);
});

fastify.get('/api/docs/:id', async (request) => {
  const { id } = request.params as { id: string };
  return docGet(Number(id));
});

fastify.post('/api/docs', async (request) => {
  return docCreate(request.body as any);
});

fastify.put('/api/docs/:id', async (request) => {
  const { id } = request.params as { id: string };
  return docUpdate(Number(id), request.body as any);
});

fastify.put('/api/docs/:id/status', async (request) => {
  const { id } = request.params as { id: string };
  const { status } = request.body as { status: string };
  return docUpdateStatus(Number(id), status);
});

// Stock Moves API（库存流水）
fastify.get('/api/moves', async (request) => {
  const query = request.query as {
    item_id?: string;
    start?: string;
    end?: string;
    limit?: string;
  };
  return stockMovesList({
    item_id: query.item_id ? Number(query.item_id) : undefined,
    start: query.start,
    end: query.end,
    limit: query.limit ? Number(query.limit) : undefined,
  });
});

fastify.get('/api/movements/recent', async (request) => {
  const { limit } = request.query as { limit?: string };
  return stockMovesRecent(limit ? Number(limit) : 50);
});

// 兼容旧 API（Claims API - 映射到统一 Docs API）
fastify.get('/api/claims', async () => {
  return docsList({ type: 'claim' });
});

fastify.get('/api/claims/:id', async (request) => {
  const { id } = request.params as { id: string };
  const doc = docGet(Number(id));
  if (!doc || doc.doc_type !== 'claim') return doc;
  // 映射为前端 ClaimDetail 格式：claim_no, note, items 含 requested_qty/item_spec
  return {
    ...doc,
    claim_no: doc.doc_no,
    note: doc.remark ?? null,
    items: (doc.lines || []).map((l: any) => ({
      ...l,
      requested_qty: l.qty,
      item_spec: l.spec,
      received_qty: 0,
    })),
  };
});

fastify.post('/api/claims', async (request) => {
  const body = request.body as any;
  return docCreate({
    doc_type: 'claim',
    doc_no: body.claim_no,
    biz_date: body.biz_date,
    requester: body.requester,
    status: body.status || 'DRAFT',
    remark: body.note,
    lines: (body.items || []).map((it: any) => ({
      item_id: it.item_id,
      qty: it.requested_qty,
      unit: it.unit || '',
      spec: it.spec,
      remark: it.remark,
      category_id: it.category_id,
    })),
  });
});

fastify.put('/api/claims/:id/status', async (request) => {
  const { id } = request.params as { id: string };
  const { status } = request.body as { status: string };
  return docUpdateStatus(Number(id), status);
});

fastify.get('/api/claims/:id/items', async (request) => {
  const { id } = request.params as { id: string };
  const doc = docGet(Number(id));
  return doc?.lines || [];
});

fastify.get('/api/claims/for-inbound', async () => {
  return docsList({ type: 'claim' })
    .filter((d) => d.status === 'SUBMITTED' || d.status === 'PARTIAL')
    .map((d) => ({
      id: d.id,
      claim_no: d.doc_no, // 映射 doc_no 到 claim_no
      biz_date: d.biz_date,
      requester: d.requester || '',
      status: d.status || '',
      note: d.remark || null,
      created_at: d.created_at,
    }));
});

// 兼容旧 API（Movements API - 映射到统一 Docs API）
fastify.post('/api/movements/in', async (request) => {
  const body = request.body as {
    item_id: number;
    qty: number;
    biz_date: string;
    operator: string;
    note?: string;
    claim_id?: number;
    category_id?: number;
  };
  const docNo = `IN-${body.biz_date}-${Date.now()}`;
  return docCreate({
    doc_type: 'inbound',
    doc_no: docNo,
    biz_date: body.biz_date,
    operator: body.operator,
    remark: body.note,
    lines: [{
      item_id: body.item_id,
      qty: body.qty,
      unit: '', // 会从 items_v2 带出
      category_id: body.category_id,
    }],
  });
});

fastify.post('/api/movements/out', async (request) => {
  const body = request.body as {
    item_id: number;
    qty: number;
    biz_date: string;
    operator: string;
    note?: string;
  };
  const docNo = `OUT-${body.biz_date}-${Date.now()}`;
  return docCreate({
    doc_type: 'outbound',
    doc_no: docNo,
    biz_date: body.biz_date,
    operator: body.operator,
    remark: body.note,
    lines: [{
      item_id: body.item_id,
      qty: body.qty,
      unit: '', // 会从 items_v2 带出
    }],
  });
});

// Reports API
fastify.get('/api/reports/daily', async (request) => {
  const { start, end, itemId, operator } = request.query as {
    start: string;
    end: string;
    itemId?: string;
    operator?: string;
  };
  return reportsDaily(start, end, itemId ? Number(itemId) : undefined, operator);
});

fastify.get('/api/reports/top-items', async (request) => {
  const { start, end, type, limit } = request.query as {
    start: string;
    end: string;
    type: string;
    limit?: string;
  };
  return reportsTopItems(start, end, type, limit ? Number(limit) : 10);
});

fastify.get('/api/reports/movements', async (request) => {
  const { start, end, itemId, operator } = request.query as {
    start: string;
    end: string;
    itemId?: string;
    operator?: string;
  };
  return reportsMovements(start, end, itemId ? Number(itemId) : undefined, operator);
});

// Backup API
fastify.get('/api/db/export', async (request, reply) => {
  const buffer = exportBackup();
  reply.type('application/octet-stream');
  reply.header('Content-Disposition', 'attachment; filename="warehouse-backup.db"');
  return Buffer.from(buffer);
});

fastify.post('/api/db/import', async (request) => {
  const data = await request.file();
  if (!data) {
    throw new Error('No file uploaded');
  }
  const buffer = await data.toBuffer();
  return importBackup(buffer.buffer as ArrayBuffer);
});

// 错误处理：翻译数据库错误消息
fastify.setErrorHandler((error, request, reply) => {
  let message = error.message || '服务器错误';
  // 翻译数据库约束错误
  if (message.includes('NOT NULL constraint')) {
    const field = message.match(/\.(\w+)/)?.[1] || '字段';
    const fieldName = field === 'unit_default' ? '单位' : field === 'name' ? '物资名称' : field;
    message = `必填字段不能为空：${fieldName}`;
  } else if (message.includes('UNIQUE constraint')) {
    message = '数据已存在，请检查唯一性约束';
  } else if (message.includes('FOREIGN KEY constraint')) {
    message = '关联数据不存在，请检查外键约束';
  }
  reply.status(error.statusCode || 500).send({ error: message, message });
});

// 启动服务器
const start = async () => {
  try {
    // 从环境变量读取端口，默认 41731
    const port = parseInt(process.env.PORT || '41731', 10);
    const host = '127.0.0.1'; // 固定监听本地，避免防火墙弹窗
    
    try {
      await fastify.listen({ port, host });
      console.log(`🚀 Server running at http://${host}:${port}`);
      // 输出端口信息供主进程解析
      console.log(`LISTENING:PORT=${port}`);
    } catch (listenErr: any) {
      // 端口占用时尝试其他端口
      if (listenErr.code === 'EADDRINUSE') {
        fastify.log.warn(`端口 ${port} 被占用，尝试其他端口...`);
        // 尝试从 41732 到 41740
        for (let tryPort = port + 1; tryPort <= port + 10; tryPort++) {
          try {
            await fastify.listen({ port: tryPort, host });
            console.log(`🚀 Server running at http://${host}:${tryPort}`);
            // 输出端口信息供主进程解析
            console.log(`LISTENING:PORT=${tryPort}`);
            return;
          } catch (retryErr: any) {
            if (retryErr.code !== 'EADDRINUSE') {
              throw retryErr;
            }
          }
        }
        throw new Error(`无法找到可用端口（尝试了 ${port}-${port + 10}）`);
      } else {
        throw listenErr;
      }
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// 优雅关闭
process.on('SIGINT', () => {
  close();
  fastify.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  close();
  fastify.close(() => {
    process.exit(0);
  });
});

start();
