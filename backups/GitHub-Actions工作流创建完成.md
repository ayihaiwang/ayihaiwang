# GitHub Actions 工作流创建完成

> 创建时间：2026-02-20  
> 目标：使用 GitHub Actions 自动构建 Windows 安装包

---

## ✅ 已完成的操作

### 1. 创建目录结构
- ✅ `.github/workflows/` 目录已创建

### 2. 创建工作流文件
- ✅ `.github/workflows/build-windows-installer.yml` 已创建

### 3. 工作流配置内容

```yaml
name: Build Windows Installer

on:
  workflow_dispatch:

jobs:
  build-windows:
    runs-on: windows-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js 18
        uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build server
        run: npm run server:build

      - name: Compile electron
        run: npm run compile

      - name: Build frontend
        run: npm run build

      - name: Build Windows installer
        run: npm run dist:win

      - name: Upload installer
        uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: |
            dist\**\*-Setup.exe
            dist\**\*.yml
            dist\**\*.blockmap
          if-no-files-found: error
```

---

## 📋 Git 提交说明

如果项目是 Git 仓库，请执行以下命令提交：

```bash
git add .github/workflows/build-windows-installer.yml
git commit -m "Add Windows installer GitHub Actions workflow"
git push
```

如果项目不是 Git 仓库，需要先初始化：

```bash
git init
git add .
git commit -m "Initial commit with GitHub Actions workflow"
git remote add origin <your-repo-url>
git push -u origin main
```

---

## 🚀 使用方法

### 1. 在 GitHub 上触发工作流

1. 打开 GitHub 仓库页面
2. 点击 "Actions" 标签
3. 选择 "Build Windows Installer" 工作流
4. 点击 "Run workflow" 按钮
5. 选择分支（通常是 main 或 master）
6. 点击 "Run workflow" 确认

### 2. 查看构建进度

- 在 Actions 页面可以看到构建进度
- 每个步骤都会显示日志输出
- 构建完成后会显示成功或失败状态

### 3. 下载安装包

构建完成后：
1. 在 Actions 页面找到完成的构建
2. 点击构建记录
3. 在 "Artifacts" 部分下载 `windows-installer`
4. 解压后找到 `仓库管理-1.0.0-Setup.exe`

---

## ✅ 工作流特性

- ✅ **无需本地 Node.js**：使用 GitHub 的 windows-latest runner
- ✅ **自动构建**：一键触发，自动完成所有步骤
- ✅ **自动上传**：构建完成后自动上传为 artifact
- ✅ **包含所有文件**：安装包、yml、blockmap 文件都会上传

---

## 📝 注意事项

1. **首次构建时间**：可能需要 10-15 分钟（安装依赖和 rebuild native 模块）
2. **后续构建**：5-10 分钟（依赖已缓存）
3. **artifact 保留时间**：GitHub 默认保留 90 天
4. **构建日志**：可以在 Actions 页面查看详细日志

---

**GitHub Actions 工作流已创建完成！** ✅
