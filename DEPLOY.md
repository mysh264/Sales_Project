# Sales & Cylinder Tracking — Deployment Handoff

This document is for copying the project to a new machine (e.g. the company
server) and bringing it up with `docker compose up`. It assumes Docker is
already installed and the daemon is running (`docker info` works).

Everything the stack needs is declared in `docker-compose.yml`. There is **no
systemd unit, no external orchestration** — Docker's own `restart:
unless-stopped` policy brings the containers back after a reboot. The only
thing the compose file does NOT contain is the external shared network and the
secrets (both below).

---

## 0. What travels with the folder vs. what doesn't

| Travels with the copy | Does NOT travel (recreate manually) |
| --- | --- |
| `docker-compose.yml` (services, volumes, networks) | `docker_shared` network (external — must be created once) |
| `Dockerfile` (app build) | `.env` (secrets — never committed) |
| `prisma/`, `app/`, `lib/`, `scripts/` (source) | Named volumes' data (`postgres_data`, etc. — copy via `pg_dump`) |
| `.env.example` (template) | The Cloudflare tunnel (`/home/mahmoud/cloudflared`, separate dir) |

The `.gitignore` already excludes `node_modules` and `.env`, so a normal
`git clone` or folder copy is clean.

---

## 1. Copy the project

```bash
# on the source machine, if moving a working DB too, dump it first:
docker exec sales_postgres pg_dump -U sales_user -d sales_tracking -F c \
  -f /tmp/sales_dump.dump
# copy /tmp/sales_dump.dump to the target machine

# on the target machine:
scp -r /home/mahmoud/Sales_Project user@server:/opt/Sales_Project
cd /opt/Sales_Project
```

---

## 2. Create the external network (REQUIRED, one time only)

`docker_shared` is declared `external: true` in the compose file, which means
**Docker expects it to already exist**. It is a plain bridge network — no
labels, no special options:

```bash
docker network create docker_shared
```

If you skip this, `docker compose up` fails with:
`network docker_shared declared as external, but could not be found`.

(On this dev machine it already exists; on a fresh server it will not.)

---

## 3. Create the `.env` from the template

The compose file requires these variables (the `${VAR:?...}` ones are
mandatory — compose refuses to start without them):

```bash
cp .env.example .env
# then edit .env:
```

| Variable | Purpose | Example |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | DB password for `sales_user` | a long random string |
| `DATABASE_URL` | connection string used by app/maintenance/backup | `postgresql://sales_user:PASSWORD@db:5432/sales_tracking` |
| `JWT_SECRET` | session signing secret, **≥ 32 chars** | `openssl rand -base64 48` |
| `APP_ORIGIN` | public HTTPS origin | `https://sales.yourcompany.com` |
| `SEED_ADMIN_PASSWORD` | bootstrap admin password, **≥ 12 chars** | a strong password |
| `POSTGRES_DB` | DB name (optional, defaults `sales_tracking`) | `sales_tracking` |
| `POSTGRES_USER` | DB user (optional, defaults `sales_user`) | `sales_user` |
| `SEED_DEMO_USERS` | create demo users (optional) | `false` |
| `AUDIT_RETENTION_DAYS` | maintenance retention (optional) | `365` |
| `BACKUP_RETENTION_DAYS` | backup rotation (optional) | `30` |

> Note: the `db` container uses host `db` (the service name) inside the Docker
> network, not `localhost`. Use `db:5432` in `DATABASE_URL` on the server too.

---

## 4. Bring the stack up

```bash
docker compose --project-name sales_project up -d --remove-orphans
```

Compose will:
1. Build the `web` and `maintenance` images from the `Dockerfile`.
2. Start `db` and wait for it to be healthy (`pg_isready`).
3. Start `web`, `maintenance`, `backup`.
4. Attach `web` to both `app_internal` (internal) and `docker_shared`.

Check it:
```bash
docker ps                                  # 4 sales containers, all "Up"
docker compose logs -f web                # watch the Next.js boot
curl -s -o /dev/null -w '%{http_code}\n' https://YOUR-ORIGIN/login   # expect 200
```

The admin user is created automatically on first boot from
`SEED_ADMIN_PASSWORD` (handled by the app's bootstrap logic).

---

## 5. Restore the database (only if migrating existing data)

```bash
# copy the dump into the running db container, then restore:
docker cp /tmp/sales_dump.dump sales_postgres:/tmp/sales_dump.dump
docker exec sales_postgres pg_restore -U sales_user -d sales_tracking \
  --no-owner --no-acl -Fc /tmp/sales_dump.dump
```
(Skip this for a fresh install — the bootstrap creates the schema + admin.)

---

## 6. The Cloudflare tunnel (separate directory)

The public entry point is **not** in this repo. It lives in
`/home/mahmoud/cloudflared` and is a separate compose project that also joins
`docker_shared` (plus its own `cf_psc_net`). To stand it up on the server:

```bash
# on the target machine, in the cloudflared dir:
cp .env.example .env
# edit .env: set CLOUDFLARE_TUNNEL_TOKEN (from Zero Trust -> Tunnels)
docker network create docker_shared        # same as step 2 (if not already done)
docker network create cf_psc_net
docker compose --project-name cloudflared up -d
```

Routing (`sales.yourcompany.com -> http://sales_nextjs:3000`) is configured in
the Cloudflare Zero Trust dashboard, not in code. After the tunnel connects,
point the public hostname at `sales_nextjs:3000` on `docker_shared`.

> Gotcha: if the route was saved in Zero Trust while `sales_nextjs` was absent,
> Cloudflare can cache a negative DNS result and keep returning 502 even after
> the container is up. Fix: re-save the route in the dashboard (or route to the
> container's static IP).

---

## 7. Reboot behavior (no action needed)

- `docker.service` must be enabled on the host: `sudo systemctl enable docker`.
- Every container has `restart: unless-stopped`, so after a host reboot the
  stack comes back on its own. The named `docker_shared` network also persists.
- Do NOT add systemd units to start these containers — Docker's restart policy
  is the supported mechanism and combining the two causes conflicts.

---

## 8. Quick reference

```bash
docker compose --project-name sales_project ps            # status
docker compose --project-name sales_project logs -f web   # app logs
docker compose --project-name sales_project down          # stop (keeps volumes)
docker compose --project-name sales_project down -v       # stop + DELETE volumes (irreversible)
docker network create docker_shared                       # one-time prerequisite
```
