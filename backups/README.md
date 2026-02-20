# 工程备份

## 当前备份

- `warehouse-app-backup-20260220-165553.tar.gz`（约 218KB，不含 node_modules/dist）

## 回滚步骤

**方式一：解压到新目录再替换**

```bash
cd /home/harbrzb
rm -rf warehouse-app-restored
mkdir warehouse-app-restored
tar -xzvf warehouse-app/backups/warehouse-app-backup-20260220-165553.tar.gz -C warehouse-app-restored
# 备份当前目录后替换
mv warehouse-app warehouse-app-broken
mv warehouse-app-restored warehouse-app
cd warehouse-app && npm install && npm run compile
```

**方式二：保留当前 node_modules，只覆盖源码**

```bash
cd /home/harbrzb/warehouse-app
# 删除源码与配置（保留 node_modules、dist、backups）
find . -maxdepth 1 ! -name '.' ! -name 'node_modules' ! -name 'dist' ! -name 'dist-electron' ! -name 'backups' ! -name '.git' -exec rm -rf {} + 2>/dev/null
rm -rf src server electron public build scripts data
# 解压备份
tar -xzvf backups/warehouse-app-backup-20260220-165553.tar.gz
# 重新编译
npm run compile
```

## 新建备份

```bash
cd /home/harbrzb/warehouse-app
tar --exclude='node_modules' --exclude='dist' --exclude='dist-electron' --exclude='.git' --exclude='backups' \
  -czvf "backups/warehouse-app-backup-$(date +%Y%m%d-%H%M%S).tar.gz" .
```
