# GitHub Actions - tsconfig.build.json 缺失修复

> 修复时间：2026-02-20  
> 问题：server/tsconfig.build.json 文件未提交到 Git

---

## ❌ 遇到的问题

**错误信息**：
```
error TS5058: The specified path does not exist: 'server/tsconfig.build.json'.
```

**原因**：
- `server/tsconfig.build.json` 文件在本地存在
- 但文件没有被提交到 Git 仓库
- GitHub Actions checkout 时没有这个文件

---

## ✅ 修复方案

### 1. 确保文件存在并提交

```bash
# 检查文件是否存在
git status server/tsconfig.build.json

# 如果文件未跟踪，添加到 Git
git add server/tsconfig.build.json

# 提交文件
git commit -m "Add server/tsconfig.build.json for backend build"

# 推送到 GitHub
git push
```

### 2. 文件内容确认

`server/tsconfig.build.json` 应该包含：

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "sourceMap": true,
    "declaration": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"]
  },
  "include": [
    "**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
```

---

## 📋 需要提交的文件清单

确保以下文件都已提交到 Git：

### 必须提交的文件

1. ✅ `.github/workflows/build-windows-installer.yml` - GitHub Actions 工作流
2. ✅ `server/tsconfig.build.json` - 后端编译配置
3. ✅ `package.json` - 项目配置（包含 server:build 脚本）
4. ✅ `package-lock.json` - 依赖锁定文件（如果存在）

### 检查命令

```bash
# 检查所有未提交的文件
git status

# 检查特定文件
git status server/tsconfig.build.json
git status .github/workflows/build-windows-installer.yml
git status package.json
```

---

## 🚀 修复步骤

### 步骤 1: 添加缺失的文件

```bash
cd "D:\仓库管理\warehouse-app"

# 添加 server/tsconfig.build.json
git add server/tsconfig.build.json

# 添加 GitHub Actions 工作流（如果未提交）
git add .github/workflows/build-windows-installer.yml

# 检查状态
git status
```

### 步骤 2: 提交并推送

```bash
git commit -m "Add server/tsconfig.build.json and update GitHub Actions workflow"
git push
```

### 步骤 3: 重新触发构建

1. 在 GitHub 仓库页面点击 "Actions"
2. 选择 "Build Windows Installer" 工作流
3. 点击 "Run workflow" 重新触发构建

---

## ✅ 修复完成

**已确认的文件**：
- ✅ `server/tsconfig.build.json` - 文件存在
- ✅ `.github/workflows/build-windows-installer.yml` - 已更新（Node.js 20）

**下一步**：
1. 提交 `server/tsconfig.build.json` 到 Git
2. 推送到 GitHub
3. 重新触发构建

---

**修复完成！提交文件后重新触发构建即可！** ✅
