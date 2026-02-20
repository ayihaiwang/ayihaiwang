# 修复 Web 模式下白屏问题报告

## 📋 问题描述

**时间**: 2026-02-18  
**问题**: Web 模式下（`npm run dev:web`）"物资申报 -> 新建申报"页面和"设置"页面打开是空白白屏  
**状态**: 已修复 ✅

## 🔍 问题定位

### 发现的错误

1. **Settings.tsx 缺少 `Space` 组件导入**
   - 第 77 行使用了 `<Space>` 组件，但没有从 `antd` 导入
   - 导致运行时错误：`Space is not defined`

2. **Claims.tsx 缺少 `InputNumber` 组件导入**
   - 第 136 行使用了 `<InputNumber>` 组件，但没有从 `antd` 导入
   - 导致运行时错误：`InputNumber is not defined`

3. **Settings.tsx 导入备份逻辑错误**
   - 使用了 `FileReader` + `ArrayBuffer` 的方式
   - 但后端 API 需要 `multipart/form-data` 格式
   - 导致导入功能无法正常工作

4. **缺少错误边界**
   - 页面出现错误时直接白屏，没有错误提示
   - 用户无法知道发生了什么问题

## ✅ 修复方案

### 1. 修复 Settings.tsx 导入问题

**文件**: `src/pages/Settings.tsx`

**修改 1**: 添加 `Space` 组件导入
```typescript
// 修改前
import { Card, List, Button, Input, message, Upload } from 'antd';

// 修改后
import { Card, List, Button, Input, message, Upload, Space } from 'antd';
```

**修改 2**: 修复导入备份逻辑
```typescript
// 修改前：使用 FileReader + ArrayBuffer
const importBackup = (file: File) => {
  const reader = new FileReader();
  reader.onload = () => {
    window.electronAPI.dbBackup
      .import(reader.result as ArrayBuffer)
      .then(() => {
        message.success('已恢复备份，请重启应用生效');
      })
      .catch((e) => message.error(e?.message || '恢复失败'));
  };
  reader.readAsArrayBuffer(file);
  return false;
};

// 修改后：直接使用 FormData
const importBackup = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('http://127.0.0.1:41731/api/db/import', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || '导入失败');
    }
    const result = await response.json();
    message.success('已恢复备份，请刷新页面查看');
    // 刷新操作员列表
    window.electronAPI.operators.list().then(setOperators as any);
  } catch (e: any) {
    message.error(e?.message || '恢复失败');
  }
  return false; // prevent upload
};
```

### 2. 修复 Claims.tsx 导入问题

**文件**: `src/pages/Claims.tsx`

**修改**: 添加 `InputNumber` 组件导入
```typescript
// 修改前
import { Card, Table, Button, Modal, Form, Input, DatePicker, Select, message } from 'antd';

// 修改后
import { Card, Table, Button, Modal, Form, Input, DatePicker, Select, message, InputNumber } from 'antd';
```

### 3. 添加错误边界组件

**文件**: `src/components/ErrorBoundary.tsx` (新建)

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 50, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Result
            status="error"
            title="页面加载失败"
            subTitle={this.state.error?.message || '发生了未知错误'}
            extra={[
              <Button type="primary" key="reload" onClick={this.handleReset}>
                刷新页面
              </Button>,
            ]}
          >
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div style={{ marginTop: 20, textAlign: 'left', background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </div>
            )}
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

### 4. 在 App.tsx 中使用错误边界

**文件**: `src/App.tsx`

**修改 1**: 导入 ErrorBoundary
```typescript
import ErrorBoundary from './components/ErrorBoundary';
```

**修改 2**: 包裹路由
```typescript
<Content style={{ padding: 24 }}>
  <ErrorBoundary>
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/inbound" element={<Inbound />} />
      <Route path="/outbound" element={<Outbound />} />
      <Route path="/inventory" element={<Inventory />} />
      <Route path="/claims" element={<Claims />} />
      <Route path="/claim/:id" element={<ClaimDetail />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </ErrorBoundary>
</Content>
```

## 🧪 验证结果

### API 测试

1. **申报单列表 API**: ✅ `GET /api/claims` - 200 OK
2. **操作员列表 API**: ✅ `GET /api/operators` - 200 OK
3. **物品列表 API**: ✅ `GET /api/items?activeOnly=true` - 200 OK
4. **创建申报单 API**: ✅ `POST /api/claims` - 200 OK

### 功能测试

1. **设置页面**:
   - ✅ 页面正常加载，不再白屏
   - ✅ 导出备份功能正常（调用 `GET /api/db/export`）
   - ✅ 导入备份功能正常（使用 `FormData` 上传文件）

2. **申报页面**:
   - ✅ 页面正常加载，不再白屏
   - ✅ 新建申报表单正常显示
   - ✅ 可以添加申报明细（使用 `InputNumber`）
   - ✅ 可以提交创建申报单

3. **错误边界**:
   - ✅ 如果页面出现错误，显示友好的错误提示
   - ✅ 开发模式下显示详细错误信息
   - ✅ 提供刷新页面按钮

## 📝 修改的文件列表

1. **src/pages/Settings.tsx**
   - 添加 `Space` 组件导入
   - 修复导入备份逻辑（使用 FormData 直接上传）

2. **src/pages/Claims.tsx**
   - 添加 `InputNumber` 组件导入

3. **src/components/ErrorBoundary.tsx** (新建)
   - 创建错误边界组件
   - 捕获 React 组件错误
   - 显示友好的错误提示

4. **src/App.tsx**
   - 导入 ErrorBoundary
   - 用 ErrorBoundary 包裹路由组件

## 🔒 关键代码片段

### Settings.tsx - 导入备份修复

```typescript
const importBackup = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('http://127.0.0.1:41731/api/db/import', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || '导入失败');
    }
    const result = await response.json();
    message.success('已恢复备份，请刷新页面查看');
    window.electronAPI.operators.list().then(setOperators as any);
  } catch (e: any) {
    message.error(e?.message || '恢复失败');
  }
  return false;
};
```

### ErrorBoundary - 错误捕获

```typescript
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  console.error('ErrorBoundary caught an error:', error, errorInfo);
  this.setState({
    error,
    errorInfo,
  });
}
```

## ✅ 修复效果

### 修复前
- ❌ 设置页面白屏（缺少 Space 组件）
- ❌ 申报页面白屏（缺少 InputNumber 组件）
- ❌ 导入备份功能无法使用
- ❌ 页面错误时直接白屏，无提示

### 修复后
- ✅ 设置页面正常显示
- ✅ 申报页面正常显示
- ✅ 导入备份功能正常
- ✅ 页面错误时显示友好提示

## 🚀 后续建议

1. **类型检查**: 考虑使用 TypeScript 严格模式，提前发现导入错误
2. **组件库统一**: 考虑创建统一的组件导入文件
3. **错误监控**: 在生产环境中添加错误监控（如 Sentry）
4. **测试覆盖**: 添加单元测试和集成测试

## 📌 总结

- ✅ 修复了所有导入错误
- ✅ 修复了导入备份逻辑
- ✅ 添加了错误边界保护
- ✅ 页面不再白屏
- ✅ 所有功能正常工作

**修复完成时间**: 2026-02-18  
**验证状态**: ✅ 通过
