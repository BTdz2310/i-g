#!/usr/bin/env bash
#
# build-artifact.sh
# ----------------------------------------------------------------------------
# Đóng gói artifact production cho APP server PVI mà KHÔNG cần APP server
# chạy `pnpm install` hay `prisma generate` (vì binaries.prisma.sh bị firewall
# chặn, và APP server không có toolchain).
#
# Toàn bộ build chạy TRONG container Linux (node:22-bookworm) để:
#   - native module (bcrypt, pg) được compile đúng nền glibc/x64 của APP server
#   - .prisma/client được generate sẵn và đóng kèm node_modules
#
# Kết quả: dist/build/insurance-gateway-<git-sha>.tar.gz
# Upload qua: Mac -> Client -> Jump -> APP, rồi `pm2 startOrRestart ecosystem.config.js`
# ----------------------------------------------------------------------------
set -euo pipefail

# --- cấu hình (khớp với môi trường local / APP server) -----------------------
NODE_IMAGE="node:22-bookworm"      # APP server là Debian bookworm; Node 22 cho pnpm 9+
PNPM_VERSION="9.10.0"              # PIN đúng version local — KHÔNG dùng @latest
PLATFORM="linux/amd64"             # ép x64 kể cả khi build trên Mac arm64

# --- đường dẫn ---------------------------------------------------------------
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
# LƯU Ý: không để output trong dist/ vì nest-cli có deleteOutDir:true sẽ xoá sạch dist/
OUT_DIR="$REPO_ROOT/build-output"
ARTIFACT="$OUT_DIR/insurance-gateway-${GIT_SHA}.tar.gz"

mkdir -p "$OUT_DIR"

echo ">> Build artifact trong $NODE_IMAGE (platform=$PLATFORM, pnpm=$PNPM_VERSION)"

# --- chạy build trong container ----------------------------------------------
# Mount source vào /src (read-write để build). Output node_modules + dist sinh
# ra ngay trong source được mount, nên sau khi container thoát ta đóng gói trên host.
docker run --rm \
  --platform "$PLATFORM" \
  -v "$REPO_ROOT":/src \
  -w /src \
  -e PNPM_VERSION="$PNPM_VERSION" \
  "$NODE_IMAGE" \
  bash -euo pipefail -c '
    echo "[container] node: $(node -v)"
    corepack enable
    corepack prepare "pnpm@${PNPM_VERSION}" --activate
    echo "[container] pnpm: $(pnpm -v)"

    # store cục bộ trong container để tránh đụng store host (đã từng gây
    # ERR_PNPM_UNEXPECTED_STORE). Dùng env var thay vì `pnpm config set` để
    # KHÔNG ghi rác store-dir vào .npmrc. Dùng node_modules sạch.
    rm -rf node_modules
    export PNPM_STORE_PATH=/src/.pnpm-store

    echo "[container] cài full deps (gồm dev để build nest + prisma CLI)"
    # Lưu ý: nếu vừa bump version trong package.json (vd prisma 6->7) thì
    # lockfile sẽ lệch -> không dùng --frozen-lockfile, để pnpm cập nhật lại.
    pnpm install --store-dir "$PNPM_STORE_PATH"

    echo "[container] prisma generate"
    pnpm prisma generate

    echo "[container] nest build"
    pnpm run build

    echo "[container] cắt devDependencies, giữ lại runtime deps + .prisma/client"
    pnpm prune --prod
    # prune --prod xoá prisma CLI (dev) nhưng .prisma/client đã generate vẫn còn.
    # @prisma/client + @prisma/adapter-pg + pg là runtime deps -> được giữ.
  '

# --- xác minh artifact đã có .prisma/client ----------------------------------
if [ ! -d "$REPO_ROOT/node_modules/.prisma/client" ]; then
  echo "!! CẢNH BÁO: không thấy node_modules/.prisma/client — prisma generate có thể đã fail." >&2
  exit 1
fi

echo ">> Đóng gói $ARTIFACT"
# Đóng gói đúng những gì APP server cần để chạy `node dist/main` / pm2.
tar -czf "$ARTIFACT" \
  dist \
  node_modules \
  package.json \
  pnpm-lock.yaml \
  prisma \
  prisma.config.ts \
  ecosystem.config.js

echo ""
echo ">> XONG."
echo "   Artifact : $ARTIFACT"
echo "   Size     : $(du -h "$ARTIFACT" | cut -f1)"
echo ""
echo "   Triển khai trên APP server (sau khi upload & giải nén):"
echo "     1) tạo file .env production (DATABASE_URL trỏ DB/VIP, các secret)"
echo "     2) mkdir -p logs"
echo "     3) pm2 startOrRestart ecosystem.config.js --env production"
echo "   KHÔNG cần pnpm install / prisma generate trên APP server."
