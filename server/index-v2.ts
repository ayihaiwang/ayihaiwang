/**
 * 后端 API 路由（使用统一 v2 模型）
 * 
 * 注意：此文件为新的统一模型版本，需要先执行迁移脚本后再使用
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { initDb, close } from './model/db';
import {
  categoriesList,
  categoryCreate,
  itemsList,
  itemCreate,
  itemUpdate,
  operatorsList,
  operatorCreate,
  docsList,
  docGet,
  docCreate,
  docUpdate,
  docUpdateStatus,
  stocksList,
  stocksAlerts,
  stockMovesList,
  stockMovesRecent,
} from './model';
import {
  ensureTables,
  seed,
  reportsDaily,
  reportsTopItems,
  reportsMovements,
  exportBackup,
  importBackup,
} from './db'; // 暂时保留旧代码用于报表和备份

const fastify = Fastify({ logger: true });

// 注册 CORS
fastify.register(cors, {
  origin: true,
});

// 注册 multipart（用于文件上传）
fastify.register(multipart);

// 初始化数据库（使用统一模型层）
initDb();

// 健康检查
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// DB 初始化（保留旧接口，但会同时创建 v2 表）
fastify.post('/api/db/init', async () => {
  return ensureTables();
});

fastify.post('/api/db/seed', async () => {
  return seed();
});

// Categories API（新增）
fastify.get('/api/categories', async () => {
  return categoriesList();
});

fastify.post('/api/categories', async (request) => {
  const { name } = request.body as { name: string };
  return categoryCreate(name);
});

// Items API（使用 v2 模型）
fastify.get('/api/items', async (request) => {
  const { activeOnly } = request.query as { activeOnly?: string };
  return itemsList(activeOnly === 'true');
});

fastify.post('/api/items', async (request) => {
  const body = request.body as {
    name: string;
    category_id?: number;
    spec_default?: string;
    unit_default: string;
    min_stock?: number;
  };
  return itemCreate(body);
});

fastify.put('/api/items/:id', async (request) => {
  const { id } = request.params as { id: string };
  return itemUpdate(Number(id), request.body as any);
});

// Stocks API（使用 v2 模型）
fastify.get('/api/stocks', async () => {
  return stocksList();
});

fastify.get('/api/stocks/alerts', async () => {
  return stocksAlerts();
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
  return docGet(Number(id));
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
  return docsList({ type: 'claim' }).filter((d) => 
    d.status === 'SUBMITTED' || d.status === 'PARTIAL'
  );
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

// Reports API（暂时保留旧代码）
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

// Backup API（暂时保留旧代码）
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
  return importBackup(buffer.buffer);
});

// 启动服务器
const start = async () => {
  try {
    await fastify.listen({ port: 41731, host: '127.0.0.1' });
    console.log('🚀 Server running at http://127.0.0.1:41731 (v2 unified model)');
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
