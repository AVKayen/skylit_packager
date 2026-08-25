#!/usr/bin/env bash
set -euo pipefail

# Needs skylit-photos Cloudflare r2 instance configured in rclone
rclone copy ./photos skylit-photos:skylit-photos --filter-from ./photos/.rclone-filter --progress
git add index.txt
git commit -m "Update index.txt"
git push
