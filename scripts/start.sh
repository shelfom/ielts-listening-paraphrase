#!/bin/bash
set -Eeuo pipefail

PORT=5000
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

echo "Starting static file server on port ${DEPLOY_RUN_PORT}..."
cd "${COZE_WORKSPACE_PATH}"

npx serve dist -l ${DEPLOY_RUN_PORT} --no-clipboard
