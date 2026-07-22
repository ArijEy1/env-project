# Azure VM deployment

Single Azure VM (`sems-vm`, Standard_B2als_v2, UAE North, resource group `sems-rg`,
IP 20.74.247.2) hosting two environments with **release-based deploys and instant
rollback**, deployed by GitHub Actions.

| Env  | Branch    | URL                     | Ports (web/api) | Database           |
|------|-----------|-------------------------|-----------------|--------------------|
| prod | `main`    | https://medi.qzz.io     | 3000 / 4000     | `env_project_prod` |
| stg  | `staging` | https://stg.medi.qzz.io | 3001 / 4001     | `env_project_stg`  |

The `medi.qzz.io` domain is temporary until the real domain is purchased; both
names are A records to the VM IP, TLS via Let's Encrypt (certbot).

## How a deploy works

Push to `main` (→ prod) or `staging` (→ stg). The workflow
(`.github/workflows/deploy.yml`, also runnable manually via *Run workflow*):

1. **Builds on the GitHub runner** — `deploy/azure/build-release.sh` runs
   `npm ci`, compiles the API, builds the web app with the env's public API URL
   baked in, and produces a ~2 MB tarball of built artifacts (no sources, no dev
   dependencies). The VM never compiles anything.
2. **Uploads** the tarball and the `sems` CLI to the VM.
3. **`sems install <env> <tarball>`** on the VM: unpacks into
   `releases/<timestamp>-<sha>/`, installs production node_modules (hardlinked
   from the previous release when the lockfile is unchanged — seconds, not
   minutes), runs migrations + the v0.4 content import, flips the `current`
   symlink, restarts systemd services, and health-checks both apps. Old releases
   are pruned (last 5 kept). Failed health checks leave previous releases intact.

Deploy history and target URLs appear under **GitHub → Environments**
(production / staging), and each run writes a status summary.

## Operating it — the `sems` CLI (on the VM)

```
ssh azureuser@20.74.247.2

sems status                # both envs: release, services, health, disk, backups, TLS
sems releases stg          # list installed releases (* = active)
sems rollback prod         # instant rollback to the previous release (DB not reverted)
sems rollback prod <id>    # …or to a specific release
sems restart stg           # restart + health-check one env
sems logs prod api -f      # follow service logs (api|web)
```

## Server layout

```
/opt/sems/
  prod/ stg/
    releases/<id>/     immutable release trees (RELEASE.json = sha, build time)
    current -> releases/<id>
    shared/api.env     secrets/config that survive releases (JWT, DB, SMTP)
    shared/web.env     web runtime port
  backups/             nightly pg_dump (02:10 UTC, kept 14 days) — /opt/sems/backup-db.sh
  .db_password         password of the `sems` postgres role
```

- **Stack**: Ubuntu 24.04, Node.js 24, PostgreSQL 18, nginx.
- **Services**: systemd template units `sems-api@{prod,stg}`, `sems-web@{prod,stg}`,
  pointing at `current/` — a deploy is a symlink flip + restart.
- **nginx**: name-based vhosts (prod on 80/medi.qzz.io, stg on stg.medi.qzz.io +
  :8080 fallback); `/api/` → NestJS, rest → Next.js; unknown hosts get 444.
- **GitHub secrets**: `VM_HOST` (IP), `VM_SSH_KEY` (dedicated deploy key).

## Bootstrap a new VM (already done for the current one)

```bash
az group create --name sems-rg --location uaenorth
az vm create -g sems-rg -n sems-vm --image Ubuntu2404 --size Standard_B2als_v2 \
  --admin-username azureuser --generate-ssh-keys --os-disk-size-gb 64
az vm open-port -g sems-rg -n sems-vm --port 80,443 --priority 900
az network nsg rule create -g sems-rg --nsg-name sems-vmNSG -n allow-stg-8080 \
  --priority 910 --destination-port-ranges 8080 --access Allow --protocol Tcp --direction Inbound

scp deploy/azure/setup-server.sh azureuser@<IP>:/tmp/ && ssh azureuser@<IP> 'bash /tmp/setup-server.sh'
scp deploy/azure/setup-envs.sh  azureuser@<IP>:/tmp/ && ssh azureuser@<IP> 'bash /tmp/setup-envs.sh <prod-domain> <stg-domain>'
```

Then: authorize a deploy key in `~azureuser/.ssh/authorized_keys`, set the
`VM_SSH_KEY`/`VM_HOST` repo secrets, fill SMTP values in `shared/api.env`,
issue certs (`sudo certbot --nginx -d <domain> --redirect`), and push.

Manual deploy without CI (same artifacts as the workflow):

```bash
deploy/azure/build-release.sh stg https://stg.medi.qzz.io/api /tmp/r.tar.gz
scp /tmp/r.tar.gz azureuser@<IP>:/tmp/ && ssh azureuser@<IP> 'sems install stg /tmp/r.tar.gz'
```

## Changing domain later

1. Point the new domain's A records at the VM.
2. Update `server_name` in `/etc/nginx/sites-available/sems`; `sudo certbot --nginx -d <new-domain> --redirect`.
3. Update `CORS_ORIGIN`/`APP_WEB_URL` in `shared/api.env`.
4. Update the URLs in `.github/workflows/deploy.yml` (they're baked into the web build) and redeploy.

## Security posture

- **Origin locked to Cloudflare**: NSG allows 80/443 only from Cloudflare's IPv4
  ranges — the VM cannot be reached directly (update the rule if Cloudflare's
  ranges change: `curl https://www.cloudflare.com/ips-v4`). Port 8080 closed.
- **Real client IPs**: nginx restores the visitor IP from `CF-Connecting-IP`
  (`conf.d/cloudflare-realip.conf`), so the app's per-IP login lockout and the
  nginx `/api/` rate limit (10 r/s, burst 30) key on real clients.
- **Apps bind to 127.0.0.1 only** (web via `-H`, API via `BIND_HOST`); postgres
  is localhost-only with peer-auth superuser.
- **SSH**: keys only, no root login, fail2ban (5 tries → 1 h ban).
- **TLS**: Let's Encrypt with auto-renew; unknown-SNI handshakes rejected;
  HSTS + security headers on web responses (helmet covers the API).
- **OS**: unattended security upgrades enabled. Backups are root-only (0600).
- **Off-VM backups**: nightly dumps also upload to Azure Blob Storage
  (`semsbkpf54aa2`/`db-backups`, UAE North) via the VM's managed identity —
  no stored keys; blobs auto-delete after 90 days (lifecycle policy). Restore:
  `azcopy copy 'https://semsbkpf54aa2.blob.core.windows.net/db-backups/<file>' . `
  (on the VM), then `pg_restore -d <db> <file>`.
- **Dependencies**: `npm audit` clean — next/react on latest, `overrides` pin
  patched sharp/postcss until Next ships them.

## Known gaps

- Email (OTP/password reset) depends on Brevo SMTP — the VM's IP must be listed
  under Brevo → SMTP & API → Authorized IPs.
- TLS certs pending the DNS A records.
- The GitHub repo is public while the SAIP report treats the source as protected IP.
