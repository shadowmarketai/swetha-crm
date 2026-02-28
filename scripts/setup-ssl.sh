#!/bin/bash
# ============================================
# VoiceFlow AI — SSL Setup Script (Let's Encrypt)
# ============================================
#
# Usage:
#   ./scripts/setup-ssl.sh yourdomain.com admin@yourdomain.com
#
# Prerequisites:
#   - Docker and docker compose installed
#   - Port 80 open and accessible from internet
#   - DNS A record pointing to this server's IP
#
# What this script does:
#   1. Obtains SSL certificate from Let's Encrypt via certbot
#   2. Updates nginx.conf to enable HTTPS + HTTP→HTTPS redirect
#   3. Reloads nginx
#   4. Sets up auto-renewal cron job

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Usage: $0 <domain> <email>"
    echo "Example: $0 voiceflow.yourdomain.com admin@yourdomain.com"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== VoiceFlow SSL Setup ==="
echo "Domain: $DOMAIN"
echo "Email:  $EMAIL"
echo ""

# Step 1: Ensure nginx is running (HTTP only)
echo "[1/4] Starting services (HTTP mode)..."
cd "$PROJECT_DIR"
docker compose up -d nginx

# Wait for nginx to be ready
sleep 3

# Step 2: Obtain certificate
echo "[2/4] Requesting SSL certificate from Let's Encrypt..."
docker compose run --rm certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --force-renewal

echo "Certificate obtained successfully!"

# Step 3: Update nginx config — replace placeholder domain
echo "[3/4] Updating nginx configuration..."
NGINX_CONF="$PROJECT_DIR/deployment/nginx.conf"

# Uncomment the HTTPS server block by replacing yourdomain.com with actual domain
# and removing comment markers
sed -i "s/yourdomain\.com/$DOMAIN/g" "$NGINX_CONF"

# Enable HTTPS redirect: uncomment the return 301 block
sed -i '/# In production, uncomment to force HTTPS redirect:/,/# }/ {
    s/# location \//location \//
    s/#     return 301/    return 301/
    s/# }/}/
}' "$NGINX_CONF"

# Uncomment the HTTPS server block
sed -i '/# server {$/,/# }$/ {
    s/^    # /    /
    s/^    #$/    /
}' "$NGINX_CONF"

# Step 4: Reload nginx
echo "[4/4] Reloading nginx with SSL..."
docker compose exec nginx nginx -s reload

# Set up auto-renewal cron
echo ""
echo "Setting up auto-renewal cron job..."
CRON_CMD="0 3 1,15 * * cd $PROJECT_DIR && docker compose run --rm certbot renew --quiet && docker compose exec nginx nginx -s reload"

# Add cron if not already present
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_CMD") | crontab -

echo ""
echo "=== SSL Setup Complete ==="
echo ""
echo "  HTTPS: https://$DOMAIN"
echo "  Certificate auto-renews on 1st and 15th of each month"
echo ""
echo "  To verify: curl -I https://$DOMAIN/health"
echo "  To renew manually: docker compose run --rm certbot renew"
echo ""
