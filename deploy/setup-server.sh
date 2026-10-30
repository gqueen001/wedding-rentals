#!/usr/bin/env bash
# One-time (and safe to re-run) setup of a fresh Ubuntu server for BUKJA. Run as root on the server:
#
#   bash setup-server.sh <site-name> [contact-phone]
#   e.g. bash setup-server.sh bukja.example.com "+993 62 00 00 00"
#
# It secures SSH and the firewall, adds swap, installs PostgreSQL and Caddy, creates the bukja
# user, database, folders and settings file (with a new random JWT secret, kept only on the
# server), and installs the service, the https site and the daily backup. The program itself is
# copied in by deploy.sh.
set -euo pipefail

SITE="${1:?usage: setup-server.sh <site-name> [contact-phone]}"
PHONE="${2:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
export DEBIAN_FRONTEND=noninteractive
# The connecting computer may send a locale this server does not have.
export LC_ALL=C.UTF-8

echo "== packages"
apt-get update -q
apt-get upgrade -yq
apt-get install -yq postgresql caddy ufw unattended-upgrades rsync
systemctl enable --now unattended-upgrades

echo "== ssh: keys only"
cat > /etc/ssh/sshd_config.d/10-bukja.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
sshd -t
# Newer Ubuntu starts sshd per connection (ssh.socket), so new logins already use this.
if systemctl is-active -q ssh.service; then systemctl reload ssh.service; fi

echo "== firewall: ssh, http, https"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "== swap (2 GB)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo 'vm.swappiness=10' > /etc/sysctl.d/90-bukja.conf
sysctl -q --system

echo "== bukja user, folders and database"
id bukja >/dev/null 2>&1 || useradd --system --home /opt/bukja --shell /usr/sbin/nologin bukja
install -d -o bukja -g bukja -m 755 /opt/bukja /opt/bukja/web
install -d -o bukja -g bukja -m 750 /var/lib/bukja /var/lib/bukja/uploads
install -d -o root -g bukja -m 750 /etc/bukja
# The bukja OS user signs in to its own database over the local socket (peer auth): no password.
sudo -u postgres psql -qtAc "SELECT 1 FROM pg_roles WHERE rolname='bukja'" | grep -q 1 ||
  sudo -u postgres createuser bukja
sudo -u postgres psql -qtAc "SELECT 1 FROM pg_database WHERE datname='bukja'" | grep -q 1 ||
  sudo -u postgres createdb -O bukja bukja

echo "== settings (/etc/bukja/bukja.env)"
ENV=/etc/bukja/bukja.env
if [ ! -f "$ENV" ]; then
  ( umask 027; cat > "$ENV" <<EOF
DATABASE_URL=postgres:///bukja?host=/var/run/postgresql&user=bukja
JWT_SECRET=$(openssl rand -hex 32)
UPLOAD_DIR=/var/lib/bukja/uploads
WEB_DIR=/opt/bukja/web
PORT=8080
EOF
  )
  chown root:bukja "$ENV"
fi
# These follow the arguments on every run; the secret above is never changed.
set_env() { sed -i "/^$1=/d" "$ENV"; echo "$1=$2" >> "$ENV"; }
set_env PUBLIC_BASE_URL "https://$SITE"
set_env CONTACT_PHONE "$PHONE"
set_env TRUSTED_PROXIES "127.0.0.1,::1"

echo "== service, https site and backups"
install -m 644 "$HERE/bukja.service" /etc/systemd/system/bukja.service
install -m 755 "$HERE/backup.sh" /usr/local/bin/bukja-backup
install -m 644 "$HERE/bukja-backup.service" "$HERE/bukja-backup.timer" /etc/systemd/system/
sed "s/{{SITE}}/$SITE/" "$HERE/Caddyfile" > /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable bukja.service
systemctl enable --now bukja-backup.timer
systemctl reload-or-restart caddy

echo "== done. Next: run deploy/deploy.sh on your computer to copy BUKJA here and start it."
