# Electron 启动问题快速修复指南

## 🚀 快速修复步骤

### 步骤 1: 清除环境变量并启动
```bash
cd ~/warehouse-app
unset ELECTRON_RUN_AS_NODE
npm run dev
```

### 步骤 2: 如果成功，永久清除环境变量
检查并删除以下文件中的 `ELECTRON_RUN_AS_NODE=1`:
- `~/.bashrc`
- `~/.zshrc`
- `~/.profile`
- `/etc/environment`

### 步骤 3: 如果仍失败，尝试不同 Electron 版本
```bash
npm install electron@31.0.0 --save-dev
npm run dev
```

---

## ✅ 已完成的修复

1. ✅ Vite 固定端口 5173，启用 strictPort
2. ✅ Electron 启动脚本使用 `node -p "require('electron')"` 获取路径
3. ✅ 启动脚本清除 `ELECTRON_RUN_AS_NODE` 并设置为 0
4. ✅ 主进程添加防呆检查（环境变量 + require 返回值）
5. ✅ 错误提示文案已更新

---

## 📋 测试命令

```bash
# 1. 清理端口
lsof -ti:5173 | xargs -r kill

# 2. 编译
npm run compile

# 3. 启动（清除环境变量）
unset ELECTRON_RUN_AS_NODE && npm run dev
```

---

## ❌ 当前问题

即使完成所有修复，`require('electron')` 仍返回字符串而非 API 对象。

**可能原因**:
- 系统环境变量 `ELECTRON_RUN_AS_NODE=1` 被全局设置
- Electron 版本/环境兼容性问题

**解决方案**: 见上方快速修复步骤

---

详细报告请查看: `ELECTRON_FIX_REPORT.md`
