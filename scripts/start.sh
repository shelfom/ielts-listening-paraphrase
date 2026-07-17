#!/bin/bash
set -Eeuo pipefail

PORT=5000
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

echo "Starting Vite preview server on port ${DEPLOY_RUN_PORT}..."
cd "${COZE_WORKSPACE_PATH}"

npx vite preview --host 0.0.0.0 --port ${DEPLOY_RUN_PORT}
