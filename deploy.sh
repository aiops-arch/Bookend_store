#!/usr/bin/env bash
# One-command deploy for the cloud server. Run this ON the server, inside the
# project folder, after you've put your files there and installed Docker.
set -e
cd "$(dirname "$0")"

echo "==> Building and starting Book Ends (backend + frontend)…"
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

echo
echo "==> Status:"
docker compose -f docker-compose.prod.yml ps

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo
echo "============================================================"
echo "  Book Ends is live."
echo "  Open:   http://${IP:-<your-server-ip>}/"
echo "  Login:  admin@fg.local  /  Admin@123   (change after first login)"
echo "============================================================"
