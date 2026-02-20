# GitHub Actions 自动构建说明

## 📋 工作流文件位置

**GitHub 仓库**：`.github/workflows/build-windows-installer.yml`  
**本地备份**：`build-scripts/build-windows-installer.yml`

## 🚀 使用方法

### 1. 在 GitHub 上触发构建

1. 打开 GitHub 仓库页面
2. 点击 "Actions" 标签
3. 选择 "Build Windows Installer" 工作流
4. 点击 "Run workflow" 按钮
5. 选择分支（main 或 master）
6. 点击 "Run workflow" 确认

### 2. 构建步骤

工作流会自动执行以下步骤：

1. ✅ Checkout 代码
2. ✅ Setup Node.js 18
3. ✅ Install dependencies (`npm ci`)
4. ✅ Build server (`npm run server:build`)
5. ✅ Compile electron (`npm run compile`)
6. ✅ Build frontend (`npm run build`)
7. ✅ Rebuild native modules (`npm run rebuild:native`)
8. ✅ Build Windows installer (`npm run dist:win`)
9. ✅ Copy installer to build-scripts
10. ✅ Upload installer as artifact

### 3. 下载安装包

构建完成后：

1. 在 Actions 页面找到完成的构建
2. 点击构建记录
3. 在 "Artifacts" 部分下载 `windows-installer`
4. 解压后找到 `仓库管理-1.0.0-Setup.exe`

## ⏱️ 构建时间

- **首次构建**：10-15 分钟
- **后续构建**：5-10 分钟（依赖已缓存）

## 📦 Artifact 内容

构建完成后，artifact 包含：

- `dist\仓库管理-1.0.0-Setup.exe` - 安装包
- `dist\*.yml` - 更新检查文件
- `dist\*.blockmap` - 增量更新文件
- `build-scripts\仓库管理-1.0.0-Setup.exe` - 复制到 build-scripts 的安装包

## ✅ 优势

- ✅ **无需本地 Node.js**：使用 GitHub 的 windows-latest runner
- ✅ **自动构建**：一键触发，自动完成所有步骤
- ✅ **自动 rebuild native 模块**：确保 better-sqlite3 正确编译
- ✅ **自动复制到 build-scripts**：方便本地使用
- ✅ **自动上传 artifact**：构建完成后可直接下载

---

**GitHub Actions 工作流已配置完成！** ✅
