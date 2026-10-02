#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
task_test_dir="$(mktemp -d "${TMPDIR:-/tmp}/polychat-video-tests.XXXXXX")"
trap 'rm -rf "$task_test_dir"' EXIT

apps/serverless/node_modules/.bin/esbuild \
  packages/utils/tests/video.test.ts \
  apps/serverless/src/controllers/video.test.ts \
  apps/client/app/utils/video-jobs.test.ts \
  --bundle --platform=node --format=cjs --outbase=. \
  --outdir="$task_test_dir" '--external:@aws-sdk/*'

node --test \
  "$task_test_dir/packages/utils/tests/video.test.js" \
  "$task_test_dir/apps/serverless/src/controllers/video.test.js" \
  "$task_test_dir/apps/client/app/utils/video-jobs.test.js"
