#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

print_usage() {
  cat <<'EOF'
OpenPencil 本地启动脚本

用法:
  bash scripts/dev-local.sh [target...]
  bun run dev:local -- [target...]

可用 target:
  full          启动 backend + web + docs
  full-desktop  启动 backend + desktop + docs
  backend       启动 Go 后端服务
  web           启动 Web 编辑器（会自动拉起 MCP）
  desktop       启动 Tauri 桌面端（会自动拉起 Web 和 MCP）
  docs          启动文档站点
  mcp           单独启动 MCP 服务
  help          显示帮助

注意:
  1. web 和 desktop 都会自动占用 MCP 的 7600/7601 端口，不要再额外同时启动 mcp。
  2. desktop 依赖 Rust/Tauri 本地环境。
  3. backend 默认监听 :8080，并将 /mcp 反代到 http://127.0.0.1:7600。

示例:
  bun run dev:local
  bun run dev:local -- full
  bun run dev:local -- web
  bun run dev:local -- backend
  bun run dev:local -- desktop
  bun run dev:local -- docs
  bun run dev:local -- mcp
  bash scripts/dev-local.sh backend web docs
EOF
}

require_bin() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "缺少依赖: $name" >&2
    exit 1
  fi
}

append_unique() {
  local value="$1"
  local existing
  for existing in "${SELECTED_TARGETS[@]:-}"; do
    if [[ "$existing" == "$value" ]]; then
      return 0
    fi
  done
  SELECTED_TARGETS+=("$value")
}

expand_target() {
  local target="$1"
  case "$target" in
    full)
      append_unique backend
      append_unique web
      append_unique docs
      ;;
    full-desktop)
      append_unique backend
      append_unique desktop
      append_unique docs
      ;;
    backend | web | desktop | docs | mcp)
      append_unique "$target"
      ;;
    help | --help | -h)
      print_usage
      exit 0
      ;;
    *)
      echo "未知 target: $target" >&2
      echo >&2
      print_usage >&2
      exit 1
      ;;
  esac
}

start_service() {
  local name="$1"
  shift

  echo "[$name] $*"
  (
    cd "$ROOT_DIR"
    "$@"
  ) &
  PIDS+=("$!")
}

start_backend() {
  echo "[backend] cd backend && FRONTEND_ORIGIN=${FRONTEND_ORIGIN:-http://localhost:1420} MCP_UPSTREAM=${MCP_UPSTREAM:-http://127.0.0.1:7600} go run ./cmd/server"
  (
    cd "$ROOT_DIR/backend"
    FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:1420}" \
      MCP_UPSTREAM="${MCP_UPSTREAM:-http://127.0.0.1:7600}" \
      go run ./cmd/server
  ) &
  PIDS+=("$!")
}

shutdown() {
  local exit_code="${1:-0}"
  if [[ "${STOPPED:-0}" -eq 1 ]]; then
    return
  fi
  STOPPED=1
  trap - INT TERM EXIT

  if [[ ${#PIDS[@]} -gt 0 ]]; then
    echo
    echo "正在停止本地服务..."
    for pid in "${PIDS[@]}"; do
      kill "$pid" 2>/dev/null || true
    done
    wait "${PIDS[@]}" 2>/dev/null || true
  fi

  exit "$exit_code"
}

wait_all() {
  while true; do
    local all_running=1

    for pid in "${PIDS[@]}"; do
      if ! kill -0 "$pid" 2>/dev/null; then
        all_running=0
        wait "$pid"
        shutdown "$?"
      fi
    done

    if [[ "$all_running" -eq 0 ]]; then
      break
    fi

    sleep 1
  done
}

require_bin bun

SELECTED_TARGETS=()
PIDS=()
STOPPED=0

if [[ $# -eq 0 ]]; then
  set -- full
fi

for target in "$@"; do
  expand_target "$target"
done

for target in "${SELECTED_TARGETS[@]}"; do
  case "$target" in
    backend)
      require_bin go
      ;;
  esac
done

has_web=0
has_desktop=0
has_mcp=0

for target in "${SELECTED_TARGETS[@]}"; do
  case "$target" in
    web) has_web=1 ;;
    desktop) has_desktop=1 ;;
    mcp) has_mcp=1 ;;
  esac
done

if [[ "$has_web" -eq 1 && "$has_desktop" -eq 1 ]]; then
  echo "web 和 desktop 不能同时启动，它们都会占用 1420 端口。" >&2
  exit 1
fi

if [[ "$has_mcp" -eq 1 && ( "$has_web" -eq 1 || "$has_desktop" -eq 1 ) ]]; then
  echo "mcp 不能与 web/desktop 同时启动；web 和 desktop 会自动拉起 MCP。" >&2
  exit 1
fi

trap 'shutdown $?' INT TERM EXIT

echo "启动目标: ${SELECTED_TARGETS[*]}"

for target in "${SELECTED_TARGETS[@]}"; do
  case "$target" in
    web)
      start_service web bun run dev
      ;;
    desktop)
      start_service desktop bun run tauri dev
      ;;
    docs)
      start_service docs bun run docs:dev
      ;;
    mcp)
      start_service mcp bun packages/mcp/src/index.ts
      ;;
    backend)
      start_backend
      ;;
  esac
done

wait_all
