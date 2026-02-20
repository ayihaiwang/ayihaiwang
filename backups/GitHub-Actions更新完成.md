# GitHub Actions 工作流更新完成

> 更新时间：2026-02-20

---

## ✅ 已完成的操作

### 1. 更新工作流文件

**文件位置**：
- GitHub：`.github/workflows/build-windows-installer.yml`
- 本地备份：`build-scripts/build-windows-installer.yml`

### 2. 更新内容

**新增步骤**：
1. ✅ **Rebuild native modules**：在构建安装包前执行 `npm run rebuild:native`
2. ✅ **Copy installer to build-scripts**：构建完成后自动复制到 `build-scripts` 目录

**更新的工作流**：

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

      - name: Rebuild native modules          # ✅ 新增
        run: npm run rebuild:native

      - name: Build Windows installer
        run: npm run dist:win

      - name: Copy installer to build-scripts  # ✅ 新增
        shell: pwsh
        run: |
          if (-not (Test-Path "build-scripts")) {
            New-Item -ItemType Directory -Path "build-scripts" | Out-Null
          }
          $installer = Get-ChildItem -Path "dist" -Filter "*-Setup.exe" | Select-Object -First 1
          if ($installer) {
            Copy-Item -Path $installer.FullName -Destination "build-scripts\$($installer.Name)" -Force
            Write-Host "Installer copied to: build-scripts\$($installer.Name)"
          }

      - name: Upload installer
        uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: |
            dist\**\*-Setup.exe
            dist\**\*.yml
            dist\**\*.blockmap
            build-scripts\*-Setup.exe          # ✅ 新增
          if-no-files-found: error
```

---

## 📋 文件位置

### GitHub Actions 工作流文件

**GitHub 仓库**：
```
.github/workflows/build-windows-installer.yml
```

**本地备份**：
```
D:\仓库管理\warehouse-app\build-scripts\build-windows-installer.yml
```

### 相关文档

**说明文档**：
```
D:\仓库管理\warehouse-app\build-scripts\README-GitHub-Actions.md
```

---

## 🚀 使用方法

### 1. 在 GitHub 上触发构建

1. 打开 GitHub 仓库页面
2. 点击 "Actions" 标签
3. 选择 "Build Windows Installer" 工作流
4. 点击 "Run workflow" 按钮
5. 选择分支（main 或 master）
6. 点击 "Run workflow" 确认

### 2. 构建完成后

- **Artifact 下载**：在 Actions 页面下载 `windows-installer`
- **本地文件**：如果仓库已克隆，`build-scripts` 目录中会有安装包

---

## ✅ 更新内容总结

1. ✅ 添加了 `Rebuild native modules` 步骤（确保 better-sqlite3 正确编译）
2. ✅ 添加了 `Copy installer to build-scripts` 步骤（自动复制到 build-scripts）
3. ✅ 更新了 artifact 上传路径（包含 build-scripts 中的安装包）
4. ✅ 工作流文件已复制到 `build-scripts` 目录作为备份

---

**GitHub Actions 工作流已更新完成！** ✅
