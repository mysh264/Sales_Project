#!/usr/bin/env bash
# /home/mahmoud/Sales_Project/scripts/sales-stack-start.sh
# Wrapper that ensures docker_shared exists with the right labels + attaches
# the 3 currently-running containers, then runs docker compose up.
# Designed to be the ExecStart of the sales-stack systemd unit.

set -e

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-sales_project}"

# Ensure the external network exists with the labels docker compose v2 expects.
# Idempotent: if the network already exists, we just ensure it has the labels
# (and re-create it if it doesn't).
ensure_network() {
  local name="$1"
  local project="$2"
  if docker network inspect "$name" >/dev/null 2>&1; then
    # Exists. Check labels.
    local have_label
    have_label=$(docker network inspect "$name" --format '{{index .Labels "com.docker.compose.project"}}' 2>/dev/null || echo "")
    if [ "$have_label" != "$project" ]; then
      echo "[start.sh] network $name exists but missing compose labels; recreating..."
      # disconnect all attached containers
      local containers
      containers=$(docker network inspect "$name" --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null | tr ' ' '\n' | grep -v '^$' || true)
      for c in $containers; do
        docker network disconnect "$name" "$c" 2>/dev/null || true
      done
      docker network rm "$name" 2>/dev/null || true
      docker network create --driver bridge --attachable \
        --label "com.docker.compose.project=$project" \
        --label "com.docker.compose.network=$name" \
        "$name" >/dev/null
      # re-attach the containers we disconnected
      for c in $containers; do
        docker network connect "$name" "$c" 2>/dev/null || true
      done
      echo "[start.sh] recreated $name with compose labels"
    else
      echo "[start.sh] network $name already has the right labels"
    fi
  else
    echo "[start.sh] creating network $name..."
    docker network create --driver bridge --attachable \
      --label "com.docker.compose.project=$project" \
      --label "com.docker.compose.network=$name" \
      "$name" >/dev/null
  fi
}

# Re-attach the three expected cross-stack containers if they're up and
# not already on the shared network. This is harmless to re-run.
reattach_containers() {
  for c in sales_nextjs sales_tunnel psc-api; do
    if docker inspect "$c" >/dev/null 2>&1; then
      local on_net
      on_net=$(docker inspect "$c" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null | tr ' ' '\n' | grep -c '^docker_shared$' || echo 0)
      if [ "$on_net" = "0" ]; then
        echo "[start.sh] attaching $c to docker_shared"
        docker network connect docker_shared "$c" 2>/dev/null || true
      fi
    fi
  done
}

cd /home/mahmoud/Sales_Project

ensure_network docker_shared "$COMPOSE_PROJECT_NAME"
reattach_containers

echo "[start.sh] running docker compose up -d --wait"
exec /usr/bin/docker compose --project-name "$COMPOSE_PROJECT_NAME" up -d --remove-orphans --wait
