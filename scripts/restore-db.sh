#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_FILE="${1:?backup file required}"

gunzip -c "${BACKUP_FILE}" | psql "${DATABASE_URL}"
printf 'restore completed from %s\n' "${BACKUP_FILE}"
