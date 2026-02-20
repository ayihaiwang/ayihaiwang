# GitHub Actions 构建失败修复说明

> 修复时间：2026-02-20  
> 问题：Node.js 版本不兼容和 package-lock.json 不同步

---

## ❌ 遇到的问题

### 1. Node.js 版本不兼容

**错误信息**：
```
npm warn EBADENGINE Unsupported engine {
  package: 'glob@13.0.5',
  required: { node: '20 || >=22' },
  current: { node: 'v18.20.8' }
}
```

**原因**：
- 工作流使用 Node.js 18
- 某些依赖包（glob, lru-cache, joi 等）需要 Node.js 20 或更高版本

### 2. package-lock.json 不同步

**错误信息**：
```
npm error `npm ci` can only install packages when your package.json and package-lock.json are in sync.
npm error Missing: electron-rebuild@3.2.9 from lock file
npm error Invalid: lock file's rimraf@3.0.2 does not satisfy rimraf@5.0.10
```

**原因**：
- package.json 中新增了依赖（electron-rebuild, rimraf）
- package-lock.json 没有更新
- `npm ci` 要求 lock 文件与 package.json 完全同步

---

## ✅ 修复方案

### 1. 升级 Node.js 版本

**修改前**：
```yaml
- name: Setup Node.js 18
  uses: actions/setup-node@v4
  with:
    node-version: "18"
```

**修改后**：
```yaml
- name: Setup Node.js 20
  uses: actions/setup-node@v4
  with:
    node-version: "20"
```

### 2. 改用 npm install 替代 npm ci

**修改前**：
```yaml
- name: Install dependencies
  run: npm ci
```

**修改后**：
```yaml
- name: Install dependencies
  run: npm install
```

**原因**：
- `npm ci` 要求 lock 文件完全同步，但当前 lock 文件可能过时
- `npm install` 会自动更新 lock 文件，更灵活

---

## 📋 更新的工作流文件

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

      - name: Setup Node.js 20              # ✅ 改为 20
        uses: actions/setup-node@v4
        with:
          node-version: "20"                 # ✅ 改为 20
          cache: "npm"

      - name: Install dependencies
        run: npm install                     # ✅ 改为 npm install

      - name: Build server
        run: npm run server:build

      - name: Compile electron
        run: npm run compile

      - name: Build frontend
        run: npm run build

      - name: Rebuild native modules
        run: npm run rebuild:native

      - name: Build Windows installer
        run: npm run dist:win

      - name: Copy installer to build-scripts
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
            build-scripts\*-Setup.exe
          if-no-files-found: error
```

---

## 🔧 本地修复 package-lock.json（可选）

如果需要保持 `npm ci`，可以在本地更新 package-lock.json：

```powershell
cd "D:\仓库管理\warehouse-app"
npm install
git add package-lock.json
git commit -m "Update package-lock.json"
git push
```

然后工作流可以改回使用 `npm ci`。

---

## ✅ 修复完成

**已更新的文件**：
- ✅ `.github/workflows/build-windows-installer.yml` - Node.js 20，npm install
- ✅ `build-scripts/build-windows-installer.yml` - 同步更新

**下一步**：
1. 提交更新的工作流文件到 GitHub
2. 重新触发构建
3. 构建应该可以成功

---

**修复完成！可以重新触发构建了！** ✅
