# 修复所有页面白屏问题报告

## 📋 问题描述

**时间**: 2026-02-18  
**问题**: Web 模式下多个页面出现白屏（React 渲染崩溃）  
**影响页面**: 
- "新建申报" 页面空白
- "设置" 页面空白
- 其他页面可能存在类似问题

**状态**: 已完全修复 ✅

## 🔍 问题定位

### 根本原因分析

1. **数组操作未做空值保护**
   - `operators.map()`、`items.map()` 等在 `undefined` 或 `null` 上调用
   - `stocks.reduce()`、`daily.reduce()` 等在未初始化的数组上调用
   - API 返回 `null` 或非数组时直接崩溃

2. **API 调用缺少错误处理**
   - 没有 `.catch()` 处理，失败时状态未重置
   - 返回数据格式不符合预期时直接使用

3. **组件渲染缺少边界检查**
   - `ClaimDetail` 在数据为空时返回 `null`，导致白屏
   - 图表数据为空时可能导致渲染错误

## ✅ 修复方案

### 1. 修复 Claims.tsx（申报页面）

**问题**: 
- `operators.map()` 和 `items.map()` 在空数组时可能报错
- API 调用缺少错误处理

**修复**:
```typescript
// 修复前
useEffect(() => {
  load();
  window.electronAPI.items.list(true).then(setItems as any);
  window.electronAPI.operators.list().then(setOperators as any);
}, []);

// 修复后
useEffect(() => {
  load();
  window.electronAPI.items.list(true)
    .then((data: any) => setItems(Array.isArray(data) ? data : []))
    .catch(() => setItems([]));
  window.electronAPI.operators.list()
    .then((data: any) => setOperators(Array.isArray(data) ? data : []))
    .catch(() => setOperators([]));
}, []);

// 修复 map 操作
options={(operators || []).map((o) => ({ label: o.name, value: o.name }))}
options={(items || []).map((i) => ({ label: i.name + ' (' + i.unit + ')', value: i.id }))}
```

### 2. 修复 Settings.tsx（设置页面）

**问题**: 
- `operators` 可能为空，但 List 组件需要数组
- API 调用缺少错误处理

**修复**:
```typescript
// 修复前
useEffect(() => {
  window.electronAPI.operators.list().then(setOperators as any);
}, []);

// 修复后
useEffect(() => {
  window.electronAPI.operators.list()
    .then((data: any) => setOperators(Array.isArray(data) ? data : []))
    .catch(() => setOperators([]));
}, []);
```

### 3. 修复 Dashboard.tsx（首页）

**问题**: 
- `stocks.reduce()` 和 `daily.reduce()` 在空数组时可能报错
- `daily.map()` 在未初始化时可能报错

**修复**:
```typescript
// 修复前
const totalQty = stocks.reduce((a, b) => a + b.qty, 0);
const in7 = daily.reduce((a, b) => a + b.in_qty, 0);
const out7 = daily.reduce((a, b) => a + b.out_qty, 0);

// 修复后
const totalQty = (stocks || []).reduce((a, b) => a + (b?.qty || 0), 0);
const in7 = (daily || []).reduce((a, b) => a + (b?.in_qty || 0), 0);
const out7 = (daily || []).reduce((a, b) => a + (b?.out_qty || 0), 0);

// 修复图表数据
xAxis: { type: 'category', data: (daily || []).map((d) => d?.date || '') },
series: [
  { name: '入库', type: 'bar', data: (daily || []).map((d) => d?.in_qty || 0) },
  { name: '出库', type: 'bar', data: (daily || []).map((d) => d?.out_qty || 0) },
]
```

### 4. 修复 Reports.tsx（报表页面）

**问题**: 
- `daily.map()`、`topOut.map()` 在空数组时可能报错
- `items.map()`、`operators.map()` 在空数组时可能报错

**修复**:
```typescript
// 修复 API 调用
const loadFilters = () => {
  window.electronAPI.items.list(true)
    .then((data: any) => setItems(Array.isArray(data) ? data : []))
    .catch(() => setItems([]));
  window.electronAPI.operators.list()
    .then((data: any) => setOperators(Array.isArray(data) ? data : []))
    .catch(() => setOperators([]));
};

// 修复图表数据
xAxis: { type: 'category', data: (daily || []).map((d) => d?.date || '') },
xAxis: { type: 'category', data: (topOut || []).map((t) => t?.item_name || '') },

// 修复 Select 选项
options={[...(items || []).map((i) => ({ label: i.name, value: i.id }))]}
options={[...(operators || []).map((o) => ({ label: o.name, value: o.name }))]}
```

### 5. 修复 Inbound.tsx（入库页面）

**问题**: 
- `items.map()`、`operators.map()`、`claims.map()` 在空数组时可能报错

**修复**:
```typescript
// 修复 API 调用
const load = () => {
  window.electronAPI.items.list(true)
    .then((data: any) => setItems(Array.isArray(data) ? data : []))
    .catch(() => setItems([]));
  window.electronAPI.operators.list()
    .then((data: any) => setOperators(Array.isArray(data) ? data : []))
    .catch(() => setOperators([]));
  window.electronAPI.claims.forInbound()
    .then((data: any) => setClaims(Array.isArray(data) ? data : []))
    .catch(() => setClaims([]));
};

// 修复 map 操作
const options = ((claimId ? filterItems : items) || []).map(...);
const opOptions = (operators || []).map(...);
options={[...(claims || []).map(...)]}
```

### 6. 修复 Outbound.tsx（出库页面）

**问题**: 
- `items.map()`、`operators.map()` 在空数组时可能报错

**修复**:
```typescript
// 修复 API 调用和 map 操作
useEffect(() => {
  window.electronAPI.items.list(true)
    .then((data: any) => setItems(Array.isArray(data) ? data : []))
    .catch(() => setItems([]));
  window.electronAPI.operators.list()
    .then((data: any) => setOperators(Array.isArray(data) ? data : []))
    .catch(() => setOperators([]));
}, []);

const options = (items || []).map(...);
const opOptions = (operators || []).map(...);
```

### 7. 修复 Inventory.tsx（库存页面）

**问题**: 
- API 调用缺少错误处理

**修复**:
```typescript
// 修复前
const load = () => {
  window.electronAPI.stocks.list().then((data: any) => {
    setList(data);
    setLoading(false);
  });
};

// 修复后
const load = () => {
  window.electronAPI.stocks.list()
    .then((data: any) => {
      setList(Array.isArray(data) ? data : []);
      setLoading(false);
    })
    .catch((e) => {
      console.error('加载库存失败:', e);
      setList([]);
      setLoading(false);
    });
};
```

### 8. 修复 ClaimDetail.tsx（申报详情页面）

**问题**: 
- 数据为空时返回 `null`，导致白屏
- `items` 可能不是数组

**修复**:
```typescript
// 修复前
if (loading || !detail) return null;
const items = (detail as ClaimDetailType).items || [];

// 修复后
if (loading) return <div style={{ padding: 20, textAlign: 'center' }}>加载中...</div>;
if (!detail) return <div style={{ padding: 20, textAlign: 'center' }}>申报单不存在</div>;
const items = Array.isArray((detail as ClaimDetailType).items) 
  ? (detail as ClaimDetailType).items 
  : [];
```

### 9. 增强 ErrorBoundary（错误边界）

**改进**:
- 始终显示错误信息（不仅开发模式）
- 打印完整堆栈信息到控制台
- 显示组件堆栈信息

**修复**:
```typescript
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  console.error('ErrorBoundary caught an error:', error, errorInfo);
  console.error('Error stack:', error.stack);
  console.error('Component stack:', errorInfo.componentStack);
  this.setState({ error, errorInfo });
}

// 始终显示错误详情
<div style={{ marginTop: 20, textAlign: 'left', background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px' }}>
    {this.state.error?.toString()}
    {this.state.error?.stack && `\n\n堆栈:\n${this.state.error.stack}`}
    {this.state.errorInfo?.componentStack && `\n\n组件堆栈:\n${this.state.errorInfo.componentStack}`}
  </pre>
</div>
```

## 🧪 验证结果

### 页面访问测试

所有页面均已验证可访问：

- ✅ `/` - 首页可访问
- ✅ `/inventory` - 库存页面可访问
- ✅ `/inbound` - 入库页面可访问
- ✅ `/outbound` - 出库页面可访问
- ✅ `/claims` - 申报列表页面可访问
- ✅ `/reports` - 报表页面可访问
- ✅ `/settings` - 设置页面可访问

### 功能测试

1. **申报页面**:
   - ✅ 页面正常加载，不再白屏
   - ✅ 新建申报表单正常显示
   - ✅ 可以添加申报明细
   - ✅ 可以提交创建申报单

2. **设置页面**:
   - ✅ 页面正常加载，不再白屏
   - ✅ 操作员列表正常显示
   - ✅ 导出/导入备份功能正常

3. **其他页面**:
   - ✅ 所有页面都有空值保护
   - ✅ API 调用失败时不会导致白屏
   - ✅ 数据为空时页面仍可正常渲染

## 📝 修改的文件列表

1. **src/pages/Claims.tsx**
   - 添加 API 调用的错误处理
   - 修复 `operators.map()` 和 `items.map()` 的空值保护

2. **src/pages/Settings.tsx**
   - 添加 API 调用的错误处理
   - 确保 `operators` 始终是数组

3. **src/pages/Dashboard.tsx**
   - 修复 `stocks.reduce()` 和 `daily.reduce()` 的空值保护
   - 修复图表数据的空值保护

4. **src/pages/Reports.tsx**
   - 添加 API 调用的错误处理
   - 修复所有 `map()` 操作的空值保护

5. **src/pages/Inbound.tsx**
   - 添加 API 调用的错误处理
   - 修复所有 `map()` 操作的空值保护

6. **src/pages/Outbound.tsx**
   - 添加 API 调用的错误处理
   - 修复所有 `map()` 操作的空值保护

7. **src/pages/Inventory.tsx**
   - 添加 API 调用的错误处理

8. **src/pages/ClaimDetail.tsx**
   - 修复数据为空时的渲染逻辑
   - 添加加载状态和错误状态显示

9. **src/components/ErrorBoundary.tsx**
   - 增强错误信息显示
   - 始终打印完整堆栈信息

## 🔒 关键修复模式

### 模式 1: API 调用保护

```typescript
// 标准模式
window.electronAPI.xxx.list()
  .then((data: any) => setState(Array.isArray(data) ? data : []))
  .catch(() => setState([]));
```

### 模式 2: 数组操作保护

```typescript
// 标准模式
(array || []).map(...)
(array || []).reduce(...)
Array.isArray(data) ? data : []
```

### 模式 3: 对象属性访问保护

```typescript
// 标准模式
obj?.property || defaultValue
(obj?.property || []).map(...)
```

## ✅ 修复效果

### 修复前
- ❌ "新建申报" 页面白屏
- ❌ "设置" 页面白屏
- ❌ API 返回空数据时页面崩溃
- ❌ 数组操作在 `undefined` 上调用导致错误

### 修复后
- ✅ 所有页面正常显示
- ✅ API 返回空数据时页面仍可渲染
- ✅ 所有数组操作都有空值保护
- ✅ 错误边界捕获所有渲染错误
- ✅ 页面不再因异常直接崩溃

## 🚀 防护措施

1. **全局错误边界**: 捕获所有组件渲染错误
2. **API 调用保护**: 所有 API 调用都有错误处理
3. **数组操作保护**: 所有 `map`、`filter`、`reduce` 都有空值检查
4. **数据验证**: 使用 `Array.isArray()` 验证数据格式
5. **默认值**: 所有状态都有合理的默认值（空数组）

## 📌 总结

- ✅ 修复了所有页面的白屏问题
- ✅ 添加了全面的空值保护
- ✅ 增强了错误边界功能
- ✅ 所有页面都可以正常访问和使用
- ✅ 系统已完全可用

**修复完成时间**: 2026-02-18  
**验证状态**: ✅ 通过
