# The Adventurer's Compendium

A fantasy DM toolkit. Currently includes a daily AI-generated quest board and a combat initiative tracker.

## Setup

1. Add your `.env` file to the project root:
   ```
   GEMINI_API_KEY=your-key-here
   DOMAIN_NAME=yourdomain.com
   ```

2. Add your assets to `public/`:
   - `public/tavern-bg.png` — background image
   - `public/cartoon-stone-texture.png` — stone texture
   - `public/weathered-scroll-transparent.png` — scroll texture for quest cards

---

## Running locally (no SSL)

```bash
npm install
npm run dev
# → http://localhost:3000
```

Or via Docker with the local compose override (HTTP only, no certbot):

```bash
docker compose -f docker-compose.local.yml up --build
# → http://localhost
```

---

## Deploying to a server with SSL

Your domain's DNS A record must point at your server's public IP before starting.

### Step 1 — Activate the bootstrap nginx config

The bootstrap config is HTTP-only so nginx can start without certs that don't exist yet.

```bash
cd nginx/templates
cp default.conf.template default.conf.template.ssl   # back up the real config
cp bootstrap.conf.template default.conf.template     # activate bootstrap
```

### Step 2 — Start the stack

```bash
docker compose up --build -d
```

Check nginx started cleanly:
```bash
docker logs compendium-nginx
```

### Step 3 — Issue the SSL certificate

```bash
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email your@email.com \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com
```

You should see: `Successfully received certificate.`

### Step 4 — Swap back to the full SSL config

```bash
cd nginx/templates
cp default.conf.template.ssl default.conf.template   # restore SSL config
```

### Step 5 — Rebuild and restart

```bash
docker compose up --build -d
```

Visit `https://yourdomain.com` — you should land on the homepage over HTTPS.

### Automatic renewal

The certbot container runs a renewal check every 12 hours automatically.
Add a weekly nginx restart to your server crontab so renewed certs are picked up:

```bash
crontab -e
# add:
0 3 * * 1 cd /path/to/adventurers-compendium && docker compose restart nginx
```

---

## Routes

| Route         | Description                  |
|---------------|------------------------------|
| `/`           | Homepage — tool directory    |
| `/quest`      | Daily AI quest board         |
| `/initiative` | Combat initiative tracker    |

## Network architecture

```
Internet → nginx (ports 80/443)
               ↓  backend network
           web:3000 (Express/Node)
```

nginx and the web container share the `backend` Docker network.
The web container is never exposed directly to the internet.
