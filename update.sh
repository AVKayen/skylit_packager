#!/usr/bin/env bash
set -euo pipefail

rclone copy ./photos skylit-photos:skylit-photos
git add index.txt
git commit -m "Update index.txt"
git push
