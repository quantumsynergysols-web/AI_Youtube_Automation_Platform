# ViralPilot deployment — Hostinger VPS

Runbook for deploying ViralPilot at `app.viralpilot.io` on an existing Hostinger VPS.
The primary topology uses one hostname: nginx serves the web app and proxies `/api/`
and `/health/` to the API. This keeps browser requests same-origin and avoids CORS
configuration drift.

Replace `VPS_IP` below with the server address. Internal `ytap` user, database, service,
and path names intentionally remain stable.

---

## 0. Before you touch the server

**DNS.** Create one A record and wait for it to resolve. Certbot cannot issue a
certificate until the hostname reaches the VPS.

```text
A   app   VPS_IP
```

```bash
dig +short app.viralpilot.io     # must print VPS_IP
```

**Capacity.** ViralPilot does not share a runtime with anything already on the box.
The API is light, but later rendering work uses FFmpeg. If another product also renders
video on the same 2 vCPU, move rendering to its own host or accept slower jobs.

---

## 1. Server packages

SSH in as root. Skip anything already installed by the other product.

```bash
apt update && apt upgrade -y
apt install -y curl git nginx postgresql redis-server ufw python3.11 python3.11-venv
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
node -v && python3.11 --version && psql --version
```

```bash
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

PostgreSQL, Redis, and application processes stay on loopback.

---

## 2. Database and Redis

Use a dedicated role and database. Choose a real password.

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE ytap LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE ytap OWNER ytap;
\c ytap
GRANT ALL ON SCHEMA public TO ytap;
SQL
```

Redis may be shared with another product, so use a dedicated database index. Index `3`
is the example below; confirm it is unused first.

```bash
redis-cli -n 3 DBSIZE      # must print 0
```

Both runtimes then use `redis://localhost:6379/3`.

---

## 3. Deploy user and code

Run as a non-root user that owns nothing else.

```bash
adduser --system --group --home /srv/ytap ytap
sudo -u ytap -H bash <<'EOF'
cd /srv/ytap
git clone https://github.com/quantumsynergysols-web/AI_Youtube_Automation_Platform.git app
cd app/apps/api    && npm ci && npx prisma generate && npm run build
cd ../worker       && python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt
cd ../web          && npm ci
EOF
```

---

## 4. Configuration

```bash
sudo -u ytap cp /srv/ytap/app/.env.example /srv/ytap/app/.env
sudo -u ytap nano /srv/ytap/app/.env
```

```ini
NODE_ENV=production
LOG_LEVEL=info

DATABASE_URL=postgresql://ytap:CHANGE_ME_STRONG_PASSWORD@localhost:5432/ytap?schema=public
REDIS_URL=redis://localhost:6379/3

API_PORT=4300
API_PUBLIC_URL=https://app.viralpilot.io
WEB_PUBLIC_URL=https://app.viralpilot.io
VITE_API_URL=https://app.viralpilot.io

# Generate 48 random bytes for each JWT secret: openssl rand -base64 48
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_CREATOR=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_STUDIO=price_...

GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://app.viralpilot.io/api/channels/callback
VITE_GOOGLE_CLIENT_ID=....apps.googleusercontent.com
TOKEN_ENCRYPTION_KEY=

SMTP_URL=smtps://user:pass@smtp.provider.com:465
MAIL_FROM="ViralPilot <no-reply@viralpilot.io>"

WORKER_RECLAIM_ON_START=1
```

```bash
chmod 600 /srv/ytap/app/.env && chown ytap:ytap /srv/ytap/app/.env
cd /srv/ytap/app/apps/api  && sudo -u ytap npx prisma migrate deploy
cd /srv/ytap/app/apps/web  && sudo -u ytap npm run build
```

Vite inlines `VITE_*` values at build time, so build the web app after the production
environment exists. `SMTP_URL` is required in production; without it, verification and
reset messages are logged rather than delivered.

---

## 5. Services

Create `/etc/systemd/system/ytap-api.service`:

```ini
[Unit]
Description=ViralPilot API
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=ytap
WorkingDirectory=/srv/ytap/app/apps/api
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/srv/ytap

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/ytap-worker.service`:

```ini
[Unit]
Description=ViralPilot worker
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=ytap
WorkingDirectory=/srv/ytap/app/apps/worker
Environment=PYTHONPATH=/srv/ytap/app/apps/worker/src
ExecStart=/srv/ytap/app/apps/worker/.venv/bin/python -m worker
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now ytap-api ytap-worker
systemctl status ytap-api ytap-worker --no-pager
curl -s localhost:4300/health/ready
```

Run one worker while `WORKER_RECLAIM_ON_START=1`; reclaim-on-boot is not safe with
multiple workers.

---

## 6. nginx — primary one-subdomain setup

Create `/etc/nginx/sites-available/ytap`:

```nginx
server {
    listen 80;
    server_name app.viralpilot.io;
    root /srv/ytap/app/apps/web/dist;
    index index.html;

    client_max_body_size 25m;

    location /api/ {
        proxy_pass         http://127.0.0.1:4300;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location /health/ {
        proxy_pass         http://127.0.0.1:4300;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

`X-Forwarded-Proto` matters because the app trusts the proxy and rate limiting uses
the forwarded client address.

```bash
ln -s /etc/nginx/sites-available/ytap /etc/nginx/sites-enabled/ytap
nginx -t && systemctl reload nginx
```

---

## 7. TLS

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d app.viralpilot.io --agree-tos -m you@viralpilot.io --redirect
systemctl status certbot.timer
```

---

## 8. Google OAuth

In Google Cloud Console, configure the OAuth web client with both environments:

- Authorized JavaScript origins: `http://localhost:5273` and `https://app.viralpilot.io`
- Authorized redirect URIs: `http://localhost:4300/api/channels/callback` and
  `https://app.viralpilot.io/api/channels/callback`

Google requires exact origin and redirect matches. Register **both** localhost and
production entries; otherwise making one environment work breaks the other. Put the client
id in `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`, add the client secret for channel
connection, then rebuild the web app.

---

## 9. Stripe

Use test mode until the product is ready to charge.

1. Create the four recurring prices and copy their ids into `.env`.
2. Add webhook endpoint `https://app.viralpilot.io/api/billing/webhook`.
3. Send `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.paid`.
4. Copy its signing secret into `STRIPE_WEBHOOK_SECRET` and restart the API.

`invoice.paid` resets `videosUsed` each period.

---

## 10. Verify

```bash
curl -s https://app.viralpilot.io/health/ready
curl -s https://app.viralpilot.io/api/billing/plans | head -c 200
API_URL=https://app.viralpilot.io node scripts/verify-g0.mjs
```

The gate script's database step must run where `DATABASE_URL` can reach PostgreSQL.
Finish by signing up at `https://app.viralpilot.io`, confirming the email arrives,
completing a Stripe test checkout, and checking that the dashboard shows the plan.

---

## Updating

```bash
sudo -u ytap -H bash <<'EOF'
cd /srv/ytap/app && git pull --ff-only
cd apps/api  && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
cd ../worker && .venv/bin/pip install -r requirements.txt
cd ../web    && npm ci && npm run build
EOF
systemctl restart ytap-api ytap-worker
curl -s localhost:4300/health/ready
```

---

## Two-subdomain alternative

If the API later needs an independently movable hostname, add `api.viralpilot.io`, serve
the API from a second nginx server block, and set `API_PUBLIC_URL` and `VITE_API_URL` to
`https://api.viralpilot.io`. Keep `WEB_PUBLIC_URL=https://app.viralpilot.io`, add the web
origin to the API CORS allowlist, issue a certificate for both hostnames, and update Google
and Stripe callback URLs. This topology adds DNS, TLS, and CORS surface area, so it is not
the default.

---

## If something is wrong

| Symptom | Cause |
| --- | --- |
| API exits at boot | `.env` is invalid; the log names the field. |
| `No module named worker` | `PYTHONPATH` is missing from the worker unit. |
| Jobs queue but never run | Worker is down, or API and worker use different Redis indexes. |
| Google button absent | `VITE_GOOGLE_CLIENT_ID` was unset at build time; rebuild after setting it. |
| Google redirect mismatch | The exact localhost or production redirect URI is absent in Google Cloud. |
| Stripe webhooks return 400 | The signing secret is wrong, or a proxy altered the raw request body. |
| Allowance never resets | `invoice.paid` is not selected for the webhook. |
