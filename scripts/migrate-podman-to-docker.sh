#!/usr/bin/env bash
# /home/mahmoud/Sales_Project/scripts/migrate-podman-to-docker.sh
# One-shot migration: stops the podman-shim stack, brings it up on real Docker,
# preserves the named volumes, and re-asserts the docker_shared external network.
# Idempotent: safe to re-run if a previous run partially succeeded.
set -euo pipefail

PROJECT_DIR="/home/mahmoud/Sales_Project"
COMPOSE="/usr/bin/docker compose --project-name sales_project"

log() { printf '\033[1;36m[migrate]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[migrate warn]\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31m[migrate fatal]\033[0m %s\n' "$*" >&2; exit 1; }

[ -d "$PROJECT_DIR" ] || die "project dir not found: $PROJECT_DIR"
command -v docker >/dev/null 2>&1 || die "docker binary not in PATH"
docker info >/dev/null 2>&1 || die "docker daemon not reachable (in docker group? newgrp docker?)"
command -v podman >/dev/null 2>&1 || die "podman not in PATH (need it to read source volumes)"

cd "$PROJECT_DIR"

# 0. Safety-net backup from the running DB (no matter what happens next)
log "step 0: safety-net pg_dump of current DB..."
mkdir -p /home/mahmoud/sales-migration
podman exec sales_postgres pg_dump -U "${POSTGRES_USER:-sales_user}" -d "${POSTGRES_DB:-sales_tracking}" -F c -f /tmp/sales_at_migration.dump
podman cp sales_postgres:/tmp/sales_at_migration.dump /home/mahmoud/sales-migration/sales_at_migration.dump
log "  backup at /home/mahmoud/sales-migration/sales_at_migration.dump ($(du -h /home/mahmoud/sales-migration/sales_at_migration.dump | cut -f1))"

# 1. Find the podman source paths for the named volumes (works for both
#    rootful /var/lib/containers/storage and rootless ~/.local/share/containers/storage)
log "step 1: locating podman volume mount points..."
PODMAN_VOL_ROOT=""
for candidate in \
  "/home/mahmoud/.local/share/containers/storage/volumes" \
  "/var/lib/containers/storage/volumes"; do
  if [ -d "$candidate" ] && [ -r "$candidate" ]; then
    PODMAN_VOL_ROOT="$candidate"
    break
  fi
done
[ -n "$PODMAN_VOL_ROOT" ] || die "could not find podman volumes dir (rootless or rootful)"
log "  podman volumes at: $PODMAN_VOL_ROOT"

# 2. Take a final fresh backup RIGHT NOW (after step 0 may be stale)
log "step 2: stopping the current stack (podman-shim or running containers)..."
podman stop sales_nextjs sales_postgres sales_project-backup-1 sales_project-maintenance-1 2>/dev/null || true
$COMPOSE stop 2>/dev/null || true
# Don't remove containers yet — we want to be able to start them back up if
# something goes wrong. We just need them stopped so we can copy their volumes.

# 3. Copy each named volume's data to a temp location
log "step 3: copying volume data to /home/mahmoud/sales-migration/ ..."
for v in sales_project_postgres_data sales_project_uploads_data sales_project_backup_data; do
  if [ -d "$PODMAN_VOL_ROOT/$v/_data" ]; then
    mkdir -p "/home/mahmoud/sales-migration/$v"
    # rsync-style copy preserving permissions/ownership
    cp -a "$PODMAN_VOL_ROOT/$v/_data/." "/home/mahmoud/sales-migration/$v/"
    log "  copied $v ($(du -sh /home/mahmoud/sales-migration/$v | cut -f1))"
  else
    warn "  no source volume for $v (skipping)"
  fi
done

# 4. Recreate the external docker_shared network under real Docker.
#    It is declared as `external: true` in docker-compose.yml, so just a plain
#    bridge network with the same name is enough — no compose labels needed.
#    Docker itself (docker.service + restart: unless-stopped) brings the stack
#    back after a reboot, so no per-project systemd unit is required.
log "step 4: recreating docker_shared network on real Docker..."
docker network rm docker_shared 2>/dev/null || true
docker network create docker_shared >/dev/null
log "  docker_shared network ready"

# 5. Start ONLY the db service with a fresh empty volume (docker compose will
#    create the volume on first `up`)
log "step 5: starting db (empty) so we have a docker volume to write into..."
$COMPOSE up -d --remove-orphans db

# 6. Wait for postgres to be ready
log "step 6: waiting for postgres to be ready..."
for i in $(seq 1 60); do
  if docker exec sales_postgres pg_isready -U "${POSTGRES_USER:-sales_user}" -d "${POSTGRES_DB:-sales_tracking}" >/dev/null 2>&1; then
    log "  postgres ready after ${i}s"
    break
  fi
  sleep 1
done

# 7. Stop db, wipe its volume, import the data
log "step 7: importing postgres data..."
$COMPOSE stop db

POSTGRES_DOCKER_VOL="/var/lib/docker/volumes/sales_project_postgres_data/_data"
if [ ! -d "$POSTGRES_DOCKER_VOL" ]; then
  die "docker postgres volume not found at $POSTGRES_DOCKER_VOL (sudo needed?)"
fi
sudo rm -rf "$POSTGRES_DOCKER_VOL"/* 2>/dev/null || rm -rf "$POSTGRES_DOCKER_VOL"/*
sudo cp -a /home/mahmoud/sales-migration/sales_project_postgres_data/. "$POSTGRES_DOCKER_VOL/"
sudo chown -R 999:999 "$POSTGRES_DOCKER_VOL"
log "  postgres data imported"

# 8. Restart db, then web, then everything else
log "step 8: bringing the full stack up..."
$COMPOSE up -d --remove-orphans

# 9. Wait for web to be healthy
log "step 9: waiting for web health..."
for i in $(seq 1 60); do
  if docker exec sales_nextjs wget -q -O- http://127.0.0.1:3000/api/health 2>/dev/null | grep -q ok; then
    log "  web healthy after ${i}s"
    break
  fi
  sleep 1
done

# 10. Import uploads + backup data into the running volumes
log "step 10: importing uploads and backup data..."
UPLOADS_DOCKER_VOL="/var/lib/docker/volumes/sales_project_uploads_data/_data"
BACKUP_DOCKER_VOL="/var/lib/docker/volumes/sales_project_backup_data/_data"
if [ -d "$UPLOADS_DOCKER_VOL" ]; then
  sudo cp -a /home/mahmoud/sales-migration/sales_project_uploads_data/. "$UPLOADS_DOCKER_VOL/" 2>/dev/null || true
fi
if [ -d "$BACKUP_DOCKER_VOL" ]; then
  sudo cp -a /home/mahmoud/sales-migration/sales_project_backup_data/. "$BACKUP_DOCKER_VOL/" 2>/dev/null || true
fi
log "  uploads + backup data imported"

# 11. Final verification
log "step 11: final verification..."
sleep 3
if docker exec sales_postgres psql -U "${POSTGRES_USER:-sales_user}" -d "${POSTGRES_DB:-sales_tracking}" -c "SELECT count(*) FROM \"User\"" 2>/dev/null | tail -3; then
  log "  DB User table is queryable (data preserved)"
else
  warn "  DB query failed — restore from /home/mahmoud/sales-migration/sales_at_migration.dump"
fi

echo ""
log "============================================================"
log "MIGRATION COMPLETE"
log "============================================================"
log "  notes:"
log "  - docker_shared is declared as 'external: true' in docker-compose.yml."
log "  - No per-project systemd unit is needed: docker.service starts on boot and"
log "    the containers use 'restart: unless-stopped', so the stack comes back"
log "    automatically after a reboot. The named docker_shared network also"
log "    persists across daemon restarts."
log "  next steps:"
log "  1.  verify: curl -fs -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/health"
log "  2.  tear down the old podman containers (they're no longer in use):"
log "        podman rm sales_postgres sales_nextjs sales_project-backup-1 sales_project-maintenance-1 sales_tunnel sales_pg_tmp 2>/dev/null"
log "  3.  keep /home/mahmoud/sales-migration/ for 30 days, then delete (it's the safety net)"
