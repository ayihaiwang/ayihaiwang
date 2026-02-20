# 修复空 JSON Body 导致 400 错误报告

## 📋 问题描述

**时间**: 2026-02-18  
**问题**: POST `/api/db/init` 和 `/api/db/seed` 请求发送空 JSON body 导致 Fastify 返回 400 错误  
**错误信息**: `FST_ERR_CTP_EMPTY_JSON_BODY`

## 🔍 根本原因分析

### 问题场景
1. 前端在 `App.tsx` 中调用 `window.electronAPI.db.init()` 和 `db.seed()`
2. API 客户端 (`src/api/client.ts`) 中这两个方法只设置了 `method: 'POST'`，没有提供 body
3. `request` 函数总是设置 `Content-Type: application/json`，即使没有 body
4. Fastify 默认的 JSON parser 不允许空 body，导致 400 错误

### 代码问题点

**前端问题** (`src/api/client.ts`):
```typescript
// 问题代码
db: {
  init: () => request<{ ok: boolean }>('/db/init', { method: 'POST' }),
  seed: () => request<{ ok: boolean }>('/db/seed', { method: 'POST' }),
}

// request 函数总是设置 Content-Type
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',  // 即使没有 body 也设置
      ...options?.headers,
    },
  });
  // ...
}
```

**后端问题** (`server/index.js`):
- Fastify 默认 JSON parser 不允许空 body
- 没有自定义 parser 处理空 body 的情况

## ✅ 修复方案

### 1. 后端修复（server/index.js）

在注册路由之前添加自定义 JSON parser，允许空 body 当 `{}` 处理：

```javascript
// 配置 JSON parser：允许空 body 当 {} 处理
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try {
    const json = body === '' ? '{}' : body;
    done(null, JSON.parse(json));
  } catch (err) {
    done(err, undefined);
  }
});
```

**位置**: 在 `fastify.register(multipart)` 之后，`initDb()` 之前

**作用**: 
- 拦截所有 `application/json` 请求
- 如果 body 为空字符串，转换为 `'{}'`
- 然后正常解析 JSON

### 2. 前端修复（src/api/client.ts）

#### 2.1 改进 request 函数

只在有 body 时才设置 `Content-Type: application/json`：

```typescript
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const hasBody = options?.body !== undefined && options?.body !== null;
  const headers: HeadersInit = {
      ...options?.headers,
  };
  // 只有在有 body 时才设置 Content-Type
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  // ...
}
```

#### 2.2 显式发送 body

为 `db.init` 和 `db.seed` 显式发送空对象：

```typescript
db: {
  init: () => request<{ ok: boolean }>('/db/init', { 
    method: 'POST', 
    body: JSON.stringify({}) 
  }),
  seed: () => request<{ ok: boolean }>('/db/seed', { 
    method: 'POST', 
    body: JSON.stringify({}) 
  }),
}
```

## 🧪 验证结果

### 测试用例

1. **空 body POST 请求**:
   ```bash
   curl -X POST http://127.0.0.1:41731/api/db/init \
     -H "Content-Type: application/json" \
     -d ""
   ```
   **结果**: ✅ `200 OK` - `{"ok":true}`

2. **正常 body POST 请求**:
   ```bash
   curl -X POST http://127.0.0.1:41731/api/db/init \
     -H "Content-Type: application/json" \
     -d "{}"
   ```
   **结果**: ✅ `200 OK` - `{"ok":true}`

3. **seed 接口空 body**:
   ```bash
   curl -X POST http://127.0.0.1:41731/api/db/seed \
     -H "Content-Type: application/json" \
     -d ""
   ```
   **结果**: ✅ `200 OK` - `{"ok":true,"message":"already seeded"}`

### 前端验证

- ✅ 页面刷新后不再出现 400 错误
- ✅ 初始化流程正常完成
- ✅ 后端日志不再显示 `FST_ERR_CTP_EMPTY_JSON_BODY`

## 📝 相关文件变更

### 修改的文件

1. **server/index.js**
   - 添加自定义 JSON parser（第 39-47 行）
   - 位置：在注册路由之前

2. **src/api/client.ts**
   - 修改 `request` 函数，条件性设置 Content-Type（第 4-17 行）
   - 修改 `db.init` 和 `db.seed`，显式发送 body（第 26-27 行）

### 未修改的文件

- `src/App.tsx` - 调用方式保持不变，无需修改
- `server/db.js` - 数据库逻辑无需修改

## 🎯 修复效果

### 修复前
- ❌ POST `/api/db/init` 空 body → 400 错误
- ❌ POST `/api/db/seed` 空 body → 400 错误
- ❌ 页面初始化失败

### 修复后
- ✅ POST `/api/db/init` 空 body → 200 OK
- ✅ POST `/api/db/seed` 空 body → 200 OK
- ✅ 页面初始化正常

## 🔒 双重保障

修复采用了双重保障策略：

1. **后端保障**: 自定义 parser 处理空 body，即使前端发送空 body 也能正常工作
2. **前端保障**: 显式发送 `{}`，避免发送空 body

这样即使未来有其他代码路径发送空 body，后端也能正确处理。

## 📚 技术细节

### Fastify Content-Type Parser

Fastify 的 `addContentTypeParser` 允许自定义特定 Content-Type 的解析逻辑：

```javascript
fastify.addContentTypeParser(
  'application/json',           // Content-Type
  { parseAs: 'string' },        // 解析为字符串
  (req, body, done) => {        // 自定义解析函数
    // body 是字符串
    // done(err, parsed) 回调
  }
);
```

### Fetch API Content-Type

- 如果设置了 `Content-Type: application/json`，必须提供有效的 JSON body
- 如果没有 body，不应该设置 `Content-Type: application/json`
- 或者显式发送 `JSON.stringify({})` 作为空对象

## 🚀 后续建议

1. **统一处理**: 考虑为所有不需要 body 的 POST 请求统一处理
2. **类型安全**: 可以考虑为 API 客户端添加 TypeScript 类型，明确哪些接口需要 body
3. **错误处理**: 如果未来遇到类似问题，可以考虑添加更详细的错误日志

## ✅ 总结

- ✅ 问题已完全修复
- ✅ 后端和前端双重保障
- ✅ 所有测试用例通过
- ✅ 页面初始化正常
- ✅ 不再出现 400 错误

修复完成时间: 2026-02-18  
验证状态: ✅ 通过
