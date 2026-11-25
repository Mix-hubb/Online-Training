# Deploy on Railway

One Railway project with two services, **api** (Express) and **web** (the built Vue site), and a Postgres
database: either **Supabase** (section 1A) or Railway's own Postgres (section 1B).
Both services build from this GitHub repo (`main`); each one uses its own folder.

```
Supabase (or Railway Postgres)   database
Railway project
├── api   (folder api/)   https://api.<your-domain>   or  <name>.up.railway.app
└── web   (folder web/)   https://www.<your-domain>   or  <name>.up.railway.app
```

The build and start settings are in the repo: `api/railway.json` and `web/railway.json`.

## 1. Create the project and the database

Railway: **New Project → Deploy from GitHub repo →** this repository.
Railway creates one service. It will fail until step 2 is done; that is expected.

### 1A. Database on Supabase

1. supabase.com → **New project**. Pick the region closest to your Railway region (e.g. Singapore for both).
   Save the database password somewhere safe (a password manager); it is needed in the URLs below.
2. In the project, open **Connect** (top bar) → **ORMs → Prisma**, or **Connection string**. You need two URLs:
   - **Transaction pooler** (host `...pooler.supabase.com`, port **6543**) → `DATABASE_URL`.
     Add `?pgbouncer=true&connection_limit=5` at the end (Prisma needs `pgbouncer=true` on this pooler).
   - **Session pooler** (same host, port **5432**) → `DIRECT_URL`. Used only by `prisma migrate`.
   Put the database password in place of `[YOUR-PASSWORD]` in both.
   (The "Direct connection" `db.<ref>.supabase.co` is IPv6 only; the poolers work from Railway.)
3. Nothing to create by hand: the api runs `prisma migrate deploy` on its first deploy and creates every table.
   The last migration also closes the tables to Supabase's **Data API** (row level security on, no rights for
   `anon` / `authenticated`): this app reads the database only through the api, never with Supabase keys.
   For extra safety you may also turn the Data API off: **Project Settings → Data API → Disable**.
   Prefer to create the tables yourself first? Supabase **SQL Editor → New query**, paste the whole of
   [`supabase-init.sql`](supabase-init.sql), **Run** (once, on the empty database). It records the migrations
   too, so the api's first deploy finds nothing to do. After adding a migration, rebuild the file with
   `npm run sql:supabase` (in `api/`).
4. Backups: the free plan has none you can restore yourself; a paid plan has daily backups (and
   point-in-time recovery as an add-on). Decide before real learners and payments are in it.

### 1B. Database on Railway instead

In the project: **New → Database → PostgreSQL**. Then `DATABASE_URL` and `DIRECT_URL` are both
`${{Postgres.DATABASE_URL}}`.

## 2. api service

Open the service → **Settings**:

| Setting | Value |
|---|---|
| Source → Root Directory | `api` |
| Config-as-code → Railway Config File | `/api/railway.json` |
| Networking → Generate Domain | yes (or a custom domain, step 5) |
| Name (top of Settings) | `api` |

The config file runs `npm run build` (Prisma client + TypeScript), runs `prisma migrate deploy` before every
deploy (creates and updates the tables), then `npm start`, and checks `/health`.

**Uploaded images:** use Bunny Storage (step 7): images are served from Bunny's CDN and survive every deploy.
Without Bunny, attach a Volume instead (right-click the service → **Attach Volume**, mount path `/app/uploads`),
or uploaded banners, covers and slips are lost on every deploy.

**Variables** (service → Variables):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Supabase: Transaction pooler URL + `?pgbouncer=true&connection_limit=5`. Railway Postgres: `${{Postgres.DATABASE_URL}}` |
| `DIRECT_URL` | Supabase: Session pooler URL. Railway Postgres: `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | a long random string (at least 32 characters). Never reuse the local one. |
| `API_URL` | the api address, e.g. `https://api.<your-domain>` (used in links to uploaded images) |
| `WEB_URL` | the web address, e.g. `https://www.<your-domain>` (CORS, email links, Stripe return) |
| `COOKIE_DOMAIN` | leave empty |
| `MAIL_FROM` | `Online Training <no-reply@<your-domain>>` (domain verified in Resend) |
| `RESEND_API_KEY` | from Resend. Empty = emails are only logged. |
| `GOOGLE_CLIENT_ID` | same as the web's `VITE_GOOGLE_CLIENT_ID`. Empty = no Google sign-in. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | from Stripe (live keys only when ready to sell) |
| `BUNNY_STREAM_*`, `BUNNY_CDN_HOSTNAME` | lesson videos (step 7) |
| `BUNNY_STORAGE_*` | images on Bunny's CDN (step 7) |

`API_URL` and `WEB_URL` must be the final addresses: image links are saved with `API_URL` in them.
If the address changes later, images uploaded before the change keep the old address.

## 3. web service

**New → GitHub Repo →** the same repository, then **Settings**:

| Setting | Value |
|---|---|
| Source → Root Directory | `web` |
| Config-as-code → Railway Config File | `/web/railway.json` |
| Networking → Generate Domain | yes (or a custom domain, step 5) |
| Name | `web` |

It builds with `npm run build` and serves `dist/` with `web/server.mjs` (no extra packages): every page route
returns the app, hashed files are cached for a year, gzip on.

**Variables** (read at **build** time: after changing one, redeploy the web service):

| Variable | Value |
|---|---|
| `VITE_API_URL` | the api address, e.g. `https://api.<your-domain>` (no trailing slash) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID, or empty |

## 4. First admin

The production database starts empty (the demo seed is for local use only). After the api deploy is green:

1. Install the Railway CLI and run `railway login`, then `railway link` in this repo and pick the project.
2. Open a shell in the api service and create the admin:
   ```
   railway ssh --service api
   npm run create-admin -- --email you@company.com --name "Your Name"
   ```
3. It prints a temporary password once. Log in on the site with it; you are asked to set a new one.

An email that already has a learner account: add `--promote` (it keeps its own password).

## 5. Company domain

Use one domain for both, e.g. `www.<your-domain>` → web and `api.<your-domain>` → api.
This matters: two `*.up.railway.app` addresses count as different sites, and Safari / iPhone then block the
login cookie. With the same company domain, login works in every browser.

1. Each service → **Settings → Networking → Custom Domain** → enter the name. Railway shows a CNAME
   (and sometimes a TXT record to verify).
2. Add those records at the domain registrar (Cloudflare: set them to **DNS only**, grey cloud, at least until
   Railway shows the certificate as issued).
3. For the bare domain (`<your-domain>` without www) set a redirect to `www` at the registrar or Cloudflare.
4. Update the variables and redeploy both: api `API_URL`, `WEB_URL`; web `VITE_API_URL`.

## 6. Outside services

- **Google sign-in:** Google Cloud Console → Credentials → the OAuth client → Authorized JavaScript origins:
  add `https://www.<your-domain>`.
- **Resend:** Domains → add `<your-domain>` → add its DNS records (SPF, DKIM) → wait for Verified.
- **Stripe:** Developers → Webhooks → endpoint `https://api.<your-domain>/stripe/webhook`
  (events `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `checkout.session.expired`) → copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

## 7. Bunny: images and videos

Everything is in one Bunny account (bunny.net): **Storage** for images, **Stream** for lesson videos.
Pick the same region everywhere (e.g. Singapore). All values go in the **api** service Variables; set a whole
group or none of it: with only part of a group the api refuses to start and names what is missing.

### 7A. Images (Bunny Storage), 2 storage zones

1. **Storage → Add Storage Zone**, name e.g. `ot-public`, main region Singapore. Open it → **FTP & API Access**:
   - `BUNNY_STORAGE_ZONE` = the zone name
   - `BUNNY_STORAGE_KEY` = **Password** (not the read-only one)
   - `BUNNY_STORAGE_HOST` = **Hostname**, e.g. `sg.storage.bunnycdn.com` (the default `storage.bunnycdn.com` is Falkenstein)
2. In that zone: **Connected Pull Zones → Connect Pull Zone → Add Pull Zone** (name e.g. `ot-images`).
   `BUNNY_STORAGE_CDN_URL` = its hostname, e.g. `https://ot-images.b-cdn.net`.
3. **Add Storage Zone** again, name e.g. `ot-private`, same region, and do **not** connect a pull zone to it.
   Payment slips and chat photos go here; nobody can open them from the internet. The api reads them and gives
   short-lived links only to people allowed to see them.
   - `BUNNY_STORAGE_PRIVATE_ZONE` = its name
   - `BUNNY_STORAGE_PRIVATE_KEY` = its **Password**

New uploads then go to Bunny. Images uploaded before keep their old api address (served from the volume while
it exists): upload them again to move them. After that the Volume is no longer needed.

### 7B. Videos (Bunny Stream)

1. **Stream → Add Video Library**, name e.g. `Online Training`, Singapore.
2. **Encoding:** turn on 720p and 1080p (and 2160p if any course allows 4K). Turn **MP4 fallback off**.
3. **API** tab:
   - `BUNNY_STREAM_LIBRARY_ID` = **Video Library ID**
   - `BUNNY_STREAM_API_KEY` = **API Key**
   - `BUNNY_CDN_HOSTNAME` = **CDN Hostname**, e.g. `vz-xxxxxxxx-xxx.b-cdn.net`
   - **Webhook URL** = `https://api.<your-domain>/bunny/webhook` (lessons switch to "ready" by themselves
     when encoding finishes)
4. **Security** tab: turn on **CDN token authentication** and copy its key → `BUNNY_STREAM_TOKEN_KEY`.
   Videos then play only through the short links the api gives to enrolled learners.
   Leave **Allowed domains** empty, or list the web address (`www.<your-domain>`).
5. Redeploy the api, open a lesson as admin and upload a video. It shows "processing" until Bunny has
   encoded it (minutes, depending on length).

## Check after each deploy

- `https://api.<your-domain>/health` returns `{"ok":true}`.
- The home page loads, and opening `/login` directly (not by clicking) works.
- Log in as admin, upload a banner: its address starts with the Bunny CDN URL (or, without Bunny, redeploy the
  api and check it still shows: the volume works).
- Play a lesson video as a learner.

## When a build fails

- "Railpack could not determine how to build the app" and the log lists `api/`, `web/`, `docs/`:
  the Root Directory is not set. Set it, then use **Deploy latest commit** (not Redeploy on the old one:
  Redeploy re-uses the old settings).
- `Invalid environment` in the api log: a required variable is missing (see the table in step 2).
- `Bunny is partly set up. Also set: ...` in the api log: add the variables it lists (step 7), or remove the group.
- Video stays "processing": the Webhook URL is missing in the Stream library, or Bunny is still encoding.
  A video that never plays (403): `BUNNY_STREAM_TOKEN_KEY` is not the CDN token authentication key of that library.
- `Environment variable not found: DIRECT_URL` during the pre-deploy step: add `DIRECT_URL`.
- `prepared statement "s0" already exists` (Supabase): `DATABASE_URL` is the Transaction pooler without
  `?pgbouncer=true`.
- `Can't reach database server` (Supabase): wrong password in the URL, the project is paused (free projects
  pause after a week without use: open it in Supabase to resume), or the Direct connection URL was used
  instead of a pooler URL.
- The site loads but every request fails: `VITE_API_URL` is wrong, or `WEB_URL` on the api does not match the
  web address exactly (CORS).
