#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:?backup file required}"

# Same container resolution as backup-db.sh:
#   1. explicit PG_CONTAINER (container id or name)
#   2. the `postgres` service of the local docker compose project
#   3. any running container whose name contains "postgres"
#   4. host psql with DATABASE_URL (original behavior)
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
  echo "psql: using postgres container $(docker inspect -f '{{.Name}}' "${PG_CONTAINER}" 2>/dev/null || echo "${PG_CONTAINER}")"
  gunzip -c "${BACKUP_FILE}" \
    | docker exec -i "${PG_CONTAINER}" \
      sh -c 'exec psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-${POSTGRES_USER:-postgres}}"' \
      > /dev/null
else
  echo "psql: no postgres container found, falling back to host psql"
  DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required (or run with docker running / set PG_CONTAINER)}"
  gunzip -c "${BACKUP_FILE}" | psql "${DATABASE_URL}" > /dev/null
fi

printf 'restore completed from %s\n' "${BACKUP_FILE}"
