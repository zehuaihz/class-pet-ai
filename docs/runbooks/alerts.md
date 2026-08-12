# Alerts runbook

Configure error tracking (e.g. Sentry) with the same redaction policy as structured logs. Alert on:

- Elevated API 5xx rate (>1% over 5 minutes).
- Readiness probe failures (`/api/health/ready`).
- AI job failure rate (>20% over 15 minutes) or queue backlog growth.
- Repeated rate-limit exhaustion on login or AI endpoints.
- Worker heartbeat loss (no `tick` completion for >5 minutes).
- Backup or restore-verification failure.

## Verification

- Liveness (`/api/health/live`) returns 200 without dependency calls.
- Readiness fails when PostgreSQL is unavailable.
- External uptime monitor should call readiness, not liveness.
- Alert payloads must not include student names, teacher notes, AI inputs/outputs, or contact information.
