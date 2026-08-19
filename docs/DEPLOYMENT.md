# Deployment — Hostinger VPS

Runbook for putting the platform on a subdomain of an existing Hostinger VPS that
already runs another product.

Replace these throughout before running anything:

| Placeholder | Meaning | Example |
| --- | --- | --- |
| `APP_DOMAIN` | web application hostname | `app.ytauto.com` |
| `API_DOMAIN` | API hostname | `api.ytauto.com` |
| `VPS_IP` | server address | `62.72.33.103` |

Auth uses bearer tokens in `localStorage`, not cookies, so the two hostnames need
only a CORS entry — no cookie-domain coupling. If you would rather avoid CORS
entirely, see [One-subdomain alternative](#one-subdomain-alternative).

---

## 0. Before you touch the server

Two things must be true or later steps fail in confusing ways.

**DNS.** Create two A records pointing at `VPS_IP`, and wait for them to resolve.
Certbot fails if it cannot reach the name it is issuing for.

```
A   app   VPS_IP
A   api   VPS_IP
```

```bash
dig +short APP_DOMAIN
dig +short API_DOMAIN     # both must print VPS_IP
```

**Capacity.** This product does not share a runtime with anything already on the
box. Phase 0 is light — an API process and a worker that currently does nothing but
echo. From Phase 2 the worker runs FFmpeg, and if the other product also renders
video on the same 2 vCPU, they will contend for the same cores. Plan to either move
rendering to its own box or accept slower renders on both. It is not a Phase 0
problem; it is a Phase 2 problem worth knowing now.

---

## 1. Server packages

SSH in as root. Skip anything already installed by the other product.

```bash
apt update && apt upgrade -y
apt install -y curl git nginx postgresql redis-server ufw python3.11 python3.11-venv
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
node -v && python3.11 --version && psql --version
```

Firewall — only HTTP, HTTPS and SSH are exposed. Postgres, Redis and the app
processes stay on loopback.

```bash
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

---

## 2. Database and Redis

A dedicated role and database. Choose a real password; do not reuse the one below.

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE ytap LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE ytap OWNER ytap;
\c ytap
GRANT ALL ON SCHEMA public TO ytap;
SQL
```

Redis is shared with whatever else is on the box, so **use a dedicated database
index** rather than the default. Index `3` below; confirm nothing else uses it.

```bash
redis-cli -n 3 DBSIZE      # must print 0
```

The app then points at `redis://localhost:6379/3`. Both `ioredis` and the Python
client honour the index in the URL, so API and worker stay isolated from the other
product's keys.

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
API_PUBLIC_URL=https://API_DOMAIN
WEB_PUBLIC_URL=https://APP_DOMAIN

# 48 random bytes each. Generate, do not invent:
#   openssl rand -base64 48
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_CREATOR=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_STUDIO=price_...

GOOGLE_CLIENT_ID=....apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=....apps.googleusercontent.com

SMTP_URL=smtps://user:pass@smtp.provider.com:465
MAIL_FROM="AI YouTube Automation <no-reply@APP_DOMAIN>"

WORKER_RECLAIM_ON_START=1
```

```bash
chmod 600 /srv/ytap/app/.env && chown ytap:ytap /srv/ytap/app/.env
```

Apply the schema, then build the web app — Vite inlines `VITE_*` at build time, so
it must be built *after* the env file exists.

```bash
cd /srv/ytap/app/apps/api  && sudo -u ytap npx prisma migrate deploy
cd /srv/ytap/app/apps/web  && sudo -u ytap npm run build
```

> `SMTP_URL` is not optional in production. Left blank, verification and reset
> emails are written to the log instead of sent, and nobody can complete signup.

---

## 5. Services

`/etc/systemd/system/ytap-api.service`

```ini
[Unit]
Description=AI YouTube Automation API
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

`/etc/systemd/system/ytap-worker.service`

```ini
[Unit]
Description=AI YouTube Automation worker
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

`PYTHONPATH` is required — the worker is not pip-installed. Without it the unit
fails with `No module named worker`.

```bash
systemctl daemon-reload
systemctl enable --now ytap-api ytap-worker
systemctl status ytap-api ytap-worker --no-pager
curl -s localhost:4300/health/ready      # expect database ok, redis ok
```

**Run one worker only.** `WORKER_RECLAIM_ON_START=1` returns jobs stranded in the
processing list to pending on boot, which is correct for a single worker and would
steal in-flight jobs from a second. Before scaling out, set it to `0` and replace it
with lease-based expiry.

---

## 6. nginx

`/etc/nginx/sites-available/ytap`

```nginx
server {
    listen 80;
    server_name APP_DOMAIN;
    root /srv/ytap/app/apps/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;   # SPA routes
    }

    location ~* \.(js|css|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

server {
    listen 80;
    server_name API_DOMAIN;

    # Rendered video will be large later; raise this before Phase 2.
    client_max_body_size 25m;

    location / {
        proxy_pass         http://127.0.0.1:4300;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

`X-Forwarded-Proto` matters: the app sets `trust proxy`, and rate limiting keys off
the real client IP rather than nginx's.

```bash
ln -s /etc/nginx/sites-available/ytap /etc/nginx/sites-enabled/ytap
nginx -t && systemctl reload nginx
```

---

## 7. TLS

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d APP_DOMAIN -d API_DOMAIN --agree-tos -m you@example.com --redirect
systemctl status certbot.timer      # renewal is automatic
```

Certbot rewrites the vhosts to listen on 443 and redirect from 80.

---

## 8. Google sign-in

Google Cloud Console → APIs and Services → Credentials → **Create OAuth client ID**
→ Web application.

- **Authorized JavaScript origins:** `https://APP_DOMAIN`
- **Authorized redirect URIs:** `https://API_DOMAIN/api/auth/google/callback`

The redirect URI is unused by FR-1.2 — the ID-token flow needs only the origin — but
FR-2 channel connection uses the authorization code flow from this same client, so
registering it now avoids a second verification round.

Put the client id in **both** `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`, then
rebuild the web app. The client secret is not needed until FR-2.

Exact-match rules: `https://APP_DOMAIN` and `https://www.APP_DOMAIN` are different
origins to Google, and http is not https.

---

## 9. Stripe

Test mode until you are ready to charge.

1. Create four recurring monthly prices — $29, $79, $199, $399 — and copy the
   `price_…` ids into `.env`.
2. Developers → Webhooks → **Add endpoint**: `https://API_DOMAIN/api/billing/webhook`
3. Send: `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`
4. Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and restart the API.

`invoice.paid` is what resets `videosUsed` each period. Omit it and allowances never
refill.

---

## 10. Verify

```bash
curl -s https://API_DOMAIN/health/ready
curl -s https://API_DOMAIN/api/billing/plans | head -c 200
```

Then the gate, from your machine:

```bash
API_URL=https://API_DOMAIN node scripts/verify-g0.mjs
```

Step 4 shells out to `prisma db execute` and will fail against a remote database
unless `DATABASE_URL` reaches it. Either run the script on the server, or verify a
real signup by email instead — which is the better test, since it also proves SMTP.

Finish by hand: sign up at `https://APP_DOMAIN`, confirm the email arrives,
subscribe with test card `4242 4242 4242 4242`, and check the dashboard reports the
plan you bought.

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

Migrations run before the restart so the new code never meets an old schema.

---

## One-subdomain alternative

To serve everything from `APP_DOMAIN` and avoid CORS, drop the second server block
and add to the first:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:4300;
    # ...same proxy headers as above
}
location /health/ {
    proxy_pass http://127.0.0.1:4300;
}
```

Then set `API_PUBLIC_URL=https://APP_DOMAIN`, `VITE_API_URL=https://APP_DOMAIN`, and
register only `https://APP_DOMAIN` with Google. One certificate, one DNS record, no
CORS. The cost is that the API cannot later be scaled or moved independently without
changing URLs.

---

## If something is wrong

| Symptom | Cause |
| --- | --- |
| API exits at boot | `.env` invalid — the config schema refuses to start rather than fail later. The log names the field. |
| `No module named worker` | `PYTHONPATH` missing from the worker unit. |
| Jobs queue but never run | Worker down, or API and worker on different Redis indexes. |
| CORS error in the browser | `WEB_PUBLIC_URL` does not exactly match the origin, scheme included. |
| Google button absent | `VITE_GOOGLE_CLIENT_ID` was unset when the web app was built. Rebuild after editing `.env`. |
| Google sign-in returns 501 | `GOOGLE_CLIENT_ID` missing from the API environment. |
| Stripe webhooks 400 | Wrong `STRIPE_WEBHOOK_SECRET`, or a proxy altering the body — the route needs raw bytes. |
| Allowance never resets | `invoice.paid` not selected on the webhook endpoint. |
