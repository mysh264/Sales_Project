#!/usr/bin/env bash
# /home/mahmoud/Sales_Project/scripts/migrate-podman-to-docker.sh
# One-shot migration: stops the podman-shim stack, brings it up on real Docker,
# preserves the named volumes, and re-asserts the docker_shared external network.
# REQUIRES: docker to be installed and the user to be in the `docker` group
# (or the script must be run with sudo / docker access). REQUIRES a recent
# DB backup in case the volume copy fails.
set -euo pipefail

PROJECT_DIR="/home/mahmoud/Sales_Project"
COMPOSE="/usr/bin/docker compose --project-name sales_project"
BACKUP="/home/mahmoud/sales_pre_docker_migration.dump"

log() { printf '\033[1;36m[migrate]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[migrate warn]\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31m[migrate fatal]\033[0m %s\n' "$*" >&2; exit 1; }

[ -d "$PROJECT_DIR" ] || die "project dir not found: $PROJECT_DIR"
[ -f "$BACKUP" ] || die "missing safety-net backup: $BACKUP"
command -v docker >/dev/null 2>&1 || die "docker binary not in PATH"
docker info >/dev/null 2>&1 || die "docker daemon not reachable (sudo? docker group?)"

cd "$PROJECT_DIR"

# 1. Confirm the safety-net backup
log "safety-net backup present: $BACKUP ($(du -h "$BACKUP" | cut -f1))"

# 2. Take a final fresh backup of the current (podman) DB
log "taking fresh pre-migration backup..."
podman exec sales_postgres pg_dump -U "${POSTGRES_USER:-sales_user}" -d "${POSTGRES_DB:-sales_tracking}" -F c -f /tmp/sales_at_migration.dump
podman cp sales_postgres:/tmp/sales_at_migration.dump /home/mahmoud/sales_at_migration.dump
log "fresh backup saved: /home/mahmoud/sales_at_migration.dump"

# 3. Stop the current podman-shim stack (keep volumes)
log "stopping podman-shim stack..."
$COMPOSE down || warn "compose down returned non-zero (continuing)"
podman stop sales_postgres sales_nextjs 2>/dev/null || true

# 4. Recreate the external network
log "recreating docker_shared network..."
docker network rm docker_shared 2>/dev/null || true
docker network create --driver bridge docker_shared >/dev/null
log "docker_shared network ready"

# 5. Export volumes from podman to host, so docker can re-import them.
#    (podman stores under /var/lib/containers/storage/volumes/...)
log "exporting postgres_data volume from podman..."
PODMAN_VOL_ROOT="/var/lib/containers/storage/volumes"
for v in postgres_data uploads_data backup_data; do
  if [ -d "$PODMAN_VOL_ROOT/$v/_data" ]; then
    mkdir -p "/tmp/podman-vol-$v"
    cp -a "$PODMAN_VOL_ROOT/$v/_data/." "/tmp/podman-vol-$v/"
    log "  exported $v -> /tmp/podman-vol-$v/ ($(du -sh /tmp/podman-vol-$v | cut -f1))"
  else
    warn "  no podman volume found for $v (skipped)"
  fi
done

# 6. Bring up under docker. The named volumes are fresh, so we'll import
#    the podman data into them right after.
log "docker compose up -d (initial, empty volumes)..."
$COMPOSE up -d --remove-orphans || die "docker compose up failed"

# 7. Wait for postgres to be healthy
log "waiting for postgres to be healthy..."
for i in $(seq 1 30); do
  if docker exec sales_postgres pg_isready -U sales_user -d sales_tracking >/dev/null 2>&1; then
    log "  postgres is ready after ${i}s"
    break
  fi
  sleep 1
done

# 8. Import the podman volume data into the new docker volumes.
#    For postgres: stop, wipe data dir, copy, start, restore from dump.
#    For uploads/backup: just copy into the live volume.
log "importing postgres data..."
docker compose --project-name sales_project stop db
sudo rm -rf /var/lib/docker/volumes/sales_project_postgres_data/_data/*
sudo cp -a /tmp/podman-vol-postgres_data/. /var/lib/docker/volumes/sales_project_postgres_data/_data/
sudo chown -R 999:999 /var/lib/docker/volumes/sales_project_postgres_data/_data
docker compose --project-name sales_project start db
for i in $(seq 1 30); do
  if docker exec sales_postgres pg_isready -U sales_user -d sales_tracking >/dev/null 2>&1; then
    log "  postgres ready after import"
    break
  fi
  sleep 1
done

log "importing uploads_data..."
sudo mkdir -p /var/lib/docker/volumes/sales_project_uploads_data/_data
sudo cp -a /tmp/podman-vol-uploads_data/. /var/lib/docker/volumes/sales_project_uploads_data/_data/ 2>/dev/null || true

log "importing backup_data..."
sudo mkdir -p /var/lib/docker/volumes/sales_project_backup_data/_data
sudo cp -a /tmp/podman-vol-backup_data/. /var/lib/docker/volumes/sales_project_backup_data/_data/ 2>/dev/null || true

# 9. Bring the whole stack back up
log "docker compose up -d (final)..."
$COMPOSE up -d --remove-orphans

# 10. Verify
log "verifying..."
sleep 5
if docker exec sales_postgres psql -U sales_user -d sales_tracking -c "SELECT count(*) FROM \"User\"" >/dev/null 2>&1; then
  log "  DB has the User table and is queryable"
else
  warn "  DB query failed — restore from /home/mahmoud/sales_at_migration.dump manually"
fi
curl -fs -o /dev/null -w "  app health: %{http_code}\n" http://127.0.0.1:3000/api/health || warn "  app health endpoint not responding yet"

log "migration complete.  review with: docker compose --project-name sales_project ps"
log "if the app is up, enable the systemd unit: sudo cp scripts/systemd/sales-stack.service /etc/systemd/system/ && sudo systemctl enable --now sales-stack.service"
