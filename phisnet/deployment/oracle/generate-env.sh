#!/usr/bin/env bash
# Creates deployment/.env with fresh random secrets. Refuses to overwrite an existing file.
# Usage: ./deployment/oracle/generate-env.sh app.example.com you@example.com
set -euo pipefail
cd "$(dirname "$0")/.."
DOMAIN="${1:?Usage: generate-env.sh <domain> [admin-email]}"
ADMIN_EMAIL="${2:-}"
[ -e .env ] && { echo ".env already exists; refusing to overwrite (it holds your encryption key)"; exit 1; }
urlsafe() { openssl rand -base64 "$1" | tr '+/' '-_' | tr -d '=\n'; }
umask 077
cat > .env <<EOF
DOMAIN=${DOMAIN}
APP_BASE_URL=https://${DOMAIN}
CORS_ORIGINS=https://${DOMAIN}
DB_PASSWORD=$(urlsafe 36)
WEB_DB_PASSWORD=$(urlsafe 36)
CONTROL_DB_PASSWORD=$(urlsafe 36)
METRICS_TOKEN=$(urlsafe 36)
SESSION_SECRET=$(urlsafe 48)
MASTER_ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')
SIMULATION_EXTERNAL_DELIVERY_ENABLED=false
SECRET_ROTATION_ENABLED=false
WORKER_DELIVERY_PAUSED=true
CAPTURE_RETENTION_DAYS=7
PWNED_PASSWORDS_ENABLED=false
DISPATCH_INTERVAL_MS=400
# Transactional mail (invitations, password resets), e.g. Brevo SMTP. Leave blank until configured.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=PhishNet
# First administrator (create-admin tool). The password is never stored here.
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_FIRST_NAME=
ADMIN_LAST_NAME=
ADMIN_ORGANIZATION=
EOF
echo "Wrote deployment/.env (mode 600). Back it up somewhere safe: losing MASTER_ENCRYPTION_KEY makes stored secrets unreadable."
