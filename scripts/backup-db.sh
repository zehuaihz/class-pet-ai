#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "${BACKUP_DIR}"

FILE="${BACKUP_DIR}/class-pet-ai-${TIMESTAMP}.sql.gz"

# Resolve where pg_dump runs:
#   1. explicit PG_CONTAINER (container id or name)
#   2. the `postgres` service of the local docker compose project
#   3. any running container whose name contains "postgres"
#   4. host pg_dump with DATABASE_URL (original behavior)
resolve_pg_container() {
  if [[ -n "${PG_CONTAINER:-}" ]]; then
    printf '%s\n' "${PG_CONTAINER}"
    return 0
  fi
  if command -v docker >/dev/null 2>&1; then
    local via_compose
    via_compose="$(docker compose ps -q postgres 2>/dev/null || true)"
    if [[ -n "${via_compose}" ]]; then
      printf '%s\n' "${via_compose}"
      return 0
    fi
    docker ps --format '{{.Names}}' 2>/dev/null | grep -i postgres | head -n1 || true
  fi
  return 0
}

PG_CONTAINER="$(resolve_pg_container)"

if [[ -n "${PG_CONTAINER}" ]]; then
  echo "pg_dump: using postgres container $(docker inspect -f '{{.Name}}' "${PG_CONTAINER}" 2>/dev/null || echo "${PG_CONTAINER}")"
  # Local socket inside the container is trusted auth, no password needed.
  docker exec "${PG_CONTAINER}" \
    sh -c 'exec pg_dump -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-${POSTGRES_USER:-postgres}}"' \
    | gzip > "${FILE}"
else
  echo "pg_dump: no postgres container found, falling back to host pg_dump"
  DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required (or run with docker running / set PG_CONTAINER)}"
  pg_dump "${DATABASE_URL}" | gzip > "${FILE}"
fi

gzip -t "${FILE}"
printf 'backup written to %s (%s)\n' "${FILE}" "$(du -h "${FILE}" | cut -f1)"
