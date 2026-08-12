# Backup and restore runbook

## Policy

- Prefer a managed PostgreSQL provider with encrypted point-in-time recovery.
- Daily logical backups retained for 30 days.
- Off-site copies encrypted at rest.
- Monthly restore drill into an isolated database.
- RPO: 24 hours. RTO: 4 hours.

## Backup

```bash
DATABASE_URL=postgresql://... ./scripts/backup-db.sh
```

Writes a gzipped SQL dump to `./backups/class-pet-ai-<timestamp>.sql.gz`.

## Restore drill

```bash
DATABASE_URL=postgresql://isolated-restore-target ./scripts/restore-db.sh ./backups/class-pet-ai-<timestamp>.sql.gz
npx prisma migrate deploy
npm run db:seed   # optional smoke seed
```

Verify migrations apply, run a ledger audit, and complete a browser smoke test before considering the drill passed.

## Notes

- Redis is disposable. Recover queues from PostgreSQL `AiJob` records; do not back Redis up as business truth.
- Never restore into the production database without an explicit change window.
