#!/usr/bin/env bash
# One-time server bootstrap for the SEMS platform on Ubuntu 24.04 (Azure VM).
# Installs: Node.js 24, PostgreSQL 18 (PGDG), nginx, and prepares app dirs.
# Run as: azureuser with sudo.
set -euo pipefail

echo "==> System update"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

echo "==> Swap (2G) — protects npm builds on a 4GB VM"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "==> Node.js 24.x"
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "==> PostgreSQL 18 (PGDG repo)"
sudo apt-get install -y postgresql-common ca-certificates
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt-get install -y postgresql-18

echo "==> nginx"
sudo apt-get install -y nginx

echo "==> fail2ban (SSH brute-force protection)"
sudo apt-get install -y fail2ban
sudo tee /etc/fail2ban/jail.local > /dev/null <<'F2B'
[sshd]
enabled = true
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
F2B
sudo systemctl enable --now fail2ban

echo "==> SSH: no root login"
echo 'PermitRootLogin no' | sudo tee /etc/ssh/sshd_config.d/60-no-root.conf > /dev/null
sudo systemctl reload ssh

echo "==> journal retention (app logs: 1G cap, 3 months)"
sudo mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=1G\nMaxRetentionSec=3month\n' | sudo tee /etc/systemd/journald.conf.d/50-sems.conf > /dev/null
sudo systemctl restart systemd-journald

echo "==> App directory + user permissions"
sudo mkdir -p /opt/sems
sudo chown azureuser:azureuser /opt/sems

echo "==> PostgreSQL app role + database"
DB_PASSWORD_FILE=/opt/sems/.db_password
if [ ! -f "$DB_PASSWORD_FILE" ]; then
  openssl rand -hex 24 > "$DB_PASSWORD_FILE"
  chmod 600 "$DB_PASSWORD_FILE"
fi
DB_PASSWORD=$(cat "$DB_PASSWORD_FILE")
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sems') THEN
    CREATE ROLE sems LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE sems PASSWORD '${DB_PASSWORD}';
  END IF;
END \$\$;
SQL
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'env_project'" | grep -q 1 || \
  sudo -u postgres createdb -O sems env_project

echo "==> Done. DB password stored in $DB_PASSWORD_FILE"
