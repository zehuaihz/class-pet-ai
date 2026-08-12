#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "${BACKUP_DIR}"

FILE="${BACKUP_DIR}/class-pet-ai-${TIMESTAMP}.sql.gz"
pg_dump "${DATABASE_URL}" | gzip > "${FILE}"
printf 'backup written to %s\n' "${FILE}"
