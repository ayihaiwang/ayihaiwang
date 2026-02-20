# 公司名称配置 + 导出申报表改版 + 申报列表排序 + UI 文案 + 库存表升级 — 修改报告

## 1. 改了哪些文件/入口

| 文件路径 | 修改内容 |
|----------|----------|
| `server/db.js` | 新增 `settings` 表；迁移 `items.spec`；`getCompanyName` / `setCompanyName`；`stocksList` 增加 category_name、spec、last_in_date；`claimGet` 的 items 增加 item_spec；`claimsList(sortBy, sortOrder)` 支持排序；`itemCreate` / `itemUpdate` 支持 spec；导出新方法 |
| `server/index.js` | GET/POST `/api/settings/company_name`；GET `/api/claims` 支持 query `sortBy`、`sortOrder` |
| `src/api/client.ts` | `settings.getCompanyName` / `setCompanyName`；`claims.list(sortBy?, sortOrder?)` |
| `src/vite-env.d.ts` | `Item.spec`；`StockRow.spec/category_name/last_in_date`；`ClaimItemRow.item_spec`；`electronAPI.settings` |
| `electron/preload.ts` | 暴露 `settings`、`claims.list(sortBy, sortOrder)` |
| `src/contexts/CompanyNameContext.tsx` | **新建**：CompanyNameProvider、useCompanyName、titleWithCompanyStatic、titleWithCompany |
| `src/App.tsx` | 用 CompanyNameProvider 包裹；标题改为 `titleWithCompany('仓库管理')`（原「小仓库管理」） |
| `src/pages/Settings.tsx` | 新增「公司名称」卡片：输入框 + 保存，调用 POST 并 refreshCompanyName |
| `src/utils/claimExport.ts` | 申报表导出改版：入参增加 mainTitle；标题用 mainTitle；去掉状态行；A4 横向；列固定为 物资名称\|型号规格\|申报数量\|单位\|备注；列宽（名称约 8 格、数量 4、单位 2、型号规格加长、备注占剩余）；Excel 设置 !cols、!merges、!pageSetup 横向 A4 |
| `src/pages/Claims.tsx` | 使用 titleWithCompany 生成 mainTitle 传给导出；列表支持 sortBy/sortOrder，Table onChange 触发请求 |
| `src/pages/ClaimDetail.tsx` | 使用 titleWithCompany，导出 PDF/Excel/打印 传入 mainTitle |
| `src/pages/Inventory.tsx` | 标题改为「库存总表」；表头增加 物品分类、规格型号；新增/编辑物资支持 规格型号；搜索（下拉选字段：物品名称/规格型号/入库日期/分类 + 关键词）；排序（物资、当前数量、最近入库日期）；导出用 filteredAndSorted |

## 2. company_name 存哪

- **表**：`settings`（key-value）
  - `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);`
- **键**：`company_name`，值即公司名称字符串（可为空）。
- **接口**：
  - `GET /api/settings/company_name` → `{ company_name: string }`
  - `POST /api/settings/company_name` → Body `{ company_name: string }`，返回 `{ ok, company_name }`
- 前端启动时通过 `CompanyNameProvider` 调 GET 拉取，设置页保存时调 POST 并刷新上下文；全站主标题与导出标题经 `titleWithCompany(base)` 生成，company_name 为空则不加前缀。

## 3. 导出如何实现 A4 横向 + 列宽

- **打印**：CSS `@page { size: A4 landscape; margin: 12mm; }`，表格 `table-layout: fixed`，列用 class 控制宽度（.col-name 8em、.col-spec 14em、.col-qty 4em、.col-unit 2em、.col-remark 自适应）。
- **PDF**：`jsPDF('l', 'mm', 'a4')` 横向 A4，用 html2canvas 渲染同一 HTML 后输出多页。
- **Excel**：`ws['!cols'] = [ { wch: 16 }, { wch: 24 }, { wch: 12 }, { wch: 6 }, { wch: 30 } ]` 控制列宽；`ws['!merges']` 合并标题行；`ws['!pageSetup'] = { orientation: 'landscape', paperSize: 9 }`（9 为 A4）设置打印横向 A4。

## 4. 排序如何实现

- **申报列表**：后端 `claimsList(sortBy, sortOrder)`，合法 sortBy 为 `biz_date`（默认）、`claim_no`，sortOrder 为 `asc`/`desc`，默认日期倒序。前端 Table 申报单号、日期列设 `sorter: true`，`onChange` 里取 `sorter.columnKey` 与 `sorter.order`，设 state 后触发 `load()`，请求 `/api/claims?sortBy=xxx&sortOrder=xxx`。
- **库存总表**：前端内存排序。下拉搜索字段 + 关键词过滤后，按 sortKey（name / qty / last_in_date）与 sortDir（asc/desc）排序；Table 对应列设 sorter 与 sortOrder，onChange 更新 sortKey/sortDir。

## 5. 验收结果

| 验收项 | 结果 |
|--------|------|
| 设置公司名称后刷新不丢 | 通过：公司名称写入 `settings` 表，启动与设置页保存后通过 GET 拉取并写入 Context，刷新页面重新请求 GET 仍为设定值。 |
| 导出三种格式版式正确 | 通过：申报表打印/PDF/Excel 均为「{公司名称}物资申报表」、无状态行、A4 横向、列固定为 物资名称\|型号规格\|申报数量\|单位\|备注，列宽按需求设置；Excel 有列宽、标题合并、横向 A4 打印设置。 |
| 列表排序正确 | 通过：申报列表点日期/申报单号表头可切换排序，请求带 sortBy/sortOrder，默认日期倒序；库存总表点物资/当前数量/最近入库日期可排序，前端排序与表头状态一致。 |
| 库存总表搜索排序可用 | 通过：库存页标题为「库存总表」，表含物品分类、规格型号列；搜索可下拉选字段（物品名称/规格型号/入库日期/分类）并输入关键词过滤；支持按库存数量、名称、最近入库日期排序。 |
| 顶部标题为「仓库管理」且可加公司名前缀 | 通过：App 头部仅改文案源头为 `titleWithCompany('仓库管理')`，未用 CSS 遮挡；设置公司名后显示「公司名+仓库管理」。 |

---

**报告结束。**
