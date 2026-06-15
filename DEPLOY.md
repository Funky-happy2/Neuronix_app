# Deploying Neuronix to an always-live URL

Goal: get Neuronix running 24/7 on a permanent link, with **no dependency on the
Mac mini**. Stack: **Koyeb** (free, always-on Node host) + **Neon** (free Postgres).
Total cost: **$0/month**.

> Why these two: Neuronix runs a WebSocket server (multiplayer + PvP duels), so it
> needs a process that never sleeps. In 2026, Koyeb's free "nano" instance and Neon's
> free Postgres are the dependable always-on free options. Render's free tier sleeps;
> Railway and Fly.io no longer have real free tiers.

---

## Step 1 — Create the Neon database (free)

1. Go to <https://neon.tech> → sign up (GitHub login is easiest).
2. Create a project (name it `neuronix`). Pick the region closest to your users.
3. Copy the **connection string** — it looks like:
   `postgresql://USER:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require`
4. Give that string to Claude (or run the migration yourself, Step 2).

## Step 2 — Load your existing accounts into Neon

A full backup of your live database is already saved at `neuronix_backup.sql`
(33 tables, your real user accounts — this file is gitignored, never committed).

Restore it into Neon (one command):

```bash
psql "<your-neon-connection-string>" -f neuronix_backup.sql
```

Verify it worked:

```bash
psql "<your-neon-connection-string>" -c "SELECT count(*) FROM users;"
```

You should see your user count (currently 4).

## Step 3 — Deploy the app on Koyeb (free)

1. Go to <https://koyeb.com> → sign up with GitHub.
2. **Create Web Service** → **GitHub** → pick the `Neuronix_app` repo, branch `main`.
3. Koyeb detects the `Dockerfile` in the repo — leave the build method as Dockerfile.
4. **Instance:** choose the **Free** (nano) instance.
5. **Port:** set the service port to **8000** (the Dockerfile listens on `$PORT`,
   which Koyeb sets to 8000).
6. **Environment variables** (Settings → Environment):
   | Name             | Value                                            |
   |------------------|--------------------------------------------------|
   | `DATABASE_URL`   | your Neon connection string (from Step 1)        |
   | `SESSION_SECRET` | any long random string (see below to generate)   |
   | `NODE_ENV`       | `production`                                      |

   Generate a session secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
7. **Deploy.** First build takes a few minutes. When it's healthy you get a permanent
   URL like `https://neuronix-yourname.koyeb.app` — that's your always-live link.

Every time you `git push` to `main`, Koyeb rebuilds and redeploys automatically.

## Step 4 (optional) — Use your own domain name

A domain is optional and separate from hosting. If you want `neuronix.com` instead of
the `*.koyeb.app` URL:

1. Buy a domain (~$10/yr) from Cloudflare, Porkbun, or Namecheap.
2. In Koyeb: Service → **Settings → Domains → Add domain**, enter your domain.
3. Koyeb shows a DNS record (a `CNAME`) to add at your domain registrar.
4. Add it; HTTPS is issued automatically within minutes.

---

## Turning off the Mac mini

Once the Koyeb URL works and shows your accounts, the Mac mini is no longer needed:

```bash
# stop the local always-on service
launchctl list | grep -i neuronix     # find the service label
pkill -f run-forever.sh                # if running via the script
```

Keep the local Postgres around until you've confirmed Neon has everything.

---

## Notes / gotchas

- **No code changes were needed** — the app already binds `0.0.0.0:$PORT`, sets
  `trust proxy`, serves the production build, and auto-creates its session table.
- The session table is created automatically on first run (`createTableIfMissing`).
- If logins don't persist, double-check `SESSION_SECRET` is set on Koyeb (the server
  refuses to start in production without it — check the deploy logs).
- Free Neon databases sleep when idle but wake on the next query in ~1s; this is fine
  for a Postgres DB (unlike a sleeping *web host*, it doesn't drop connections live).
