#!/usr/bin/env bash
# Configure the prod + stg environments on the SEMS VM (release-based layout).
# Idempotent — safe to rerun; existing shared env files are never overwritten.
#
# Usage: setup-envs.sh [prod-domain] [stg-domain]
set -euo pipefail

PROD_DOMAIN="${1:-medi.qzz.io}"
STG_DOMAIN="${2:-stg.medi.qzz.io}"
DB_PASSWORD=$(cat /opt/sems/.db_password)

echo "==> Directory layout (releases/current/shared per env)"
mkdir -p /opt/sems/prod/releases /opt/sems/prod/shared
mkdir -p /opt/sems/stg/releases /opt/sems/stg/shared
mkdir -p /opt/sems/backups

echo "==> Databases"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='env_project_prod'" | grep -q 1 || sudo -u postgres createdb -O sems env_project_prod
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='env_project_stg'"  | grep -q 1 || sudo -u postgres createdb -O sems env_project_stg

write_api_env() { # <env> <api-port> <web-url>
  local env=$1 apiport=$2 weburl=$3
  local envfile=/opt/sems/$env/shared/api.env
  if [ -f "$envfile" ]; then echo "  $envfile exists, keeping"; return; fi
  cat > "$envfile" <<EOF
NODE_ENV=production
PORT=$apiport
TRUST_PROXY=1
FORCE_HTTPS=true
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=8h
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_USER=sems
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=env_project_$env
POSTGRES_SSL=false
SKIP_DB_CREATE=true
CORS_ORIGIN=$weburl
APP_WEB_URL=$weburl
PASSWORD_RESET_TTL_MINUTES=30
DRAFT_REMINDER_DAYS=3
DRAFT_RETENTION_DAYS=30
# SMTP — set real credentials here, then: sems restart $env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
EOF
  chmod 600 "$envfile"
  echo "  wrote $envfile"
}

write_web_env() { # <env> <web-port>
  local envfile=/opt/sems/$1/shared/web.env
  if [ -f "$envfile" ]; then echo "  $envfile exists, keeping"; return; fi
  printf 'PORT=%s\n' "$2" > "$envfile"
  echo "  wrote $envfile"
}

echo "==> Shared env files"
write_api_env prod 4000 "https://$PROD_DOMAIN"
write_api_env stg  4001 "https://$STG_DOMAIN"
write_web_env prod 3000
write_web_env stg  3001

echo "==> systemd template units"
sudo tee /etc/systemd/system/sems-api@.service > /dev/null <<'EOF'
[Unit]
Description=SEMS API (NestJS) — %i
After=network.target postgresql.service
Wants=postgresql.service
StartLimitIntervalSec=0

[Service]
Type=simple
User=azureuser
WorkingDirectory=/opt/sems/%i/current/apps/api
EnvironmentFile=/opt/sems/%i/shared/api.env
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/sems-web@.service > /dev/null <<'EOF'
[Unit]
Description=SEMS Web (Next.js) — %i
After=network.target sems-api@%i.service
StartLimitIntervalSec=0

[Service]
Type=simple
User=azureuser
WorkingDirectory=/opt/sems/%i/current/apps/web
Environment=NODE_ENV=production
EnvironmentFile=/opt/sems/%i/shared/web.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable sems-api@prod sems-web@prod sems-api@stg sems-web@stg 2>/dev/null

echo "==> nginx vhosts"
if grep -q 'managed by Certbot' /etc/nginx/sites-available/sems 2>/dev/null; then
  echo "  certbot-managed config present — NOT overwriting (edit it in place instead)"
else
sudo tee /etc/nginx/sites-available/sems > /dev/null <<EOF
map \$http_upgrade \$connection_upgrade { default upgrade; "" close; }

# prod
server {
    listen 80;
    listen [::]:80;
    server_name ${PROD_DOMAIN};
    client_max_body_size 10m;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
    }
}

# staging (also reachable on :8080 as fallback)
server {
    listen 80;
    listen [::]:80;
    listen 8080;
    listen [::]:8080;
    server_name ${STG_DOMAIN};
    client_max_body_size 10m;

    location /api/ {
        proxy_pass http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
    }
}

# default: refuse unknown hosts / raw IP
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}
EOF
fi
sudo ln -sf /etc/nginx/sites-available/sems /etc/nginx/sites-enabled/sems
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "==> Nightly database backups (02:10, kept 14 days)"
sudo tee /opt/sems/backup-db.sh > /dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
d=$(date +%F)
for db in env_project_prod env_project_stg; do
  sudo -u postgres pg_dump -Fc "$db" > "/opt/sems/backups/${db}-${d}.dump.tmp"
  mv "/opt/sems/backups/${db}-${d}.dump.tmp" "/opt/sems/backups/${db}-${d}.dump"
done
find /opt/sems/backups -name '*.dump' -mtime +14 -delete
EOF
sudo chmod +x /opt/sems/backup-db.sh
echo '10 2 * * * root /opt/sems/backup-db.sh' | sudo tee /etc/cron.d/sems-backup > /dev/null

echo "==> Done"
