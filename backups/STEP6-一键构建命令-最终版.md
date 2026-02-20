# STEP 6: 一键构建命令 - 最终版（可直接复制）

> 生成时间：2026-02-20  
> 目标：提供可直接复制粘贴的构建命令

---

## A) PowerShell 多行版（推荐）

```powershell
cd "D:\仓库管理\warehouse-app"
npm install
npm run server:build
npm run rebuild:native
npm run compile
npm run build
npm run dist:win
```

**使用方法**：复制上述所有行，粘贴到 PowerShell 中执行。

---

## B) PowerShell 单行版

```powershell
cd "D:\仓库管理\warehouse-app"; npm install; npm run server:build; npm run rebuild:native; npm run compile; npm run build; npm run dist:win
```

**使用方法**：复制整行，粘贴到 PowerShell 中执行。

---

## C) CMD 单行版

```cmd
cd /d "D:\仓库管理\warehouse-app" && npm install && npm run server:build && npm run rebuild:native && npm run compile && npm run build && npm run dist:win
```

**使用方法**：复制整行，粘贴到 CMD 中执行。

---

## 输出产物

**安装包位置**：
```
dist\仓库管理-1.0.0-Setup.exe
```

---

## 验证步骤

1. **安装安装包**：双击 `dist\仓库管理-1.0.0-Setup.exe`
2. **启动应用**：从桌面或开始菜单启动
3. **检查健康端点**：`http://127.0.0.1:41731/api/health`（或实际端口）
4. **检查数据库**：`%APPDATA%\warehouse-app\warehouse.db`

---

## 注意事项

- 确保在 Windows 10/11 x64 上执行
- 确保有足够的磁盘空间（至少 1GB）
- 如果端口 41731 被占用，后端会自动切换到其他端口（41732-41740）
