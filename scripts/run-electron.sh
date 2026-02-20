#!/usr/bin/env bash
# 确保以正确环境启动 Electron，避免 require('electron') 解析到 node 包
# 使用 env -i 创建完全干净的环境，只保留必要的变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ELECTRON_BIN="$(node -p "require('electron')")"
PATCH_SCRIPT="$PROJECT_ROOT/scripts/electron-patch.js"
exec env -i \
  ELECTRON_RUN_AS_NODE=0 \
  PATH="$PATH" \
  HOME="$HOME" \
  USER="$USER" \
  DISPLAY="${DISPLAY:-:0}" \
  XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u 2>/dev/null || echo 1000)}" \
  LANG="${LANG:-C.UTF-8}" \
  "$ELECTRON_BIN" --require "$PATCH_SCRIPT" "$@"
