# Shiv Sampada Parking — Deployment Guide

Deploy the app to production using:
- **Frontend** → Cloudflare Pages
- **Backend** → Render (Web Service)
- **Database** → MongoDB Atlas

Total setup time: ~30 minutes, all free tiers.

---

## Overview

```
[User phone]  →  Cloudflare Pages (React)  →  Render (FastAPI)  →  MongoDB Atlas
                 shivsampada.pages.dev        shiv-api.onrender.com   cluster0.xxx.mongodb.net
```

Deploy in this order: **Atlas → Render → Cloudflare Pages**. The backend needs Atlas, and the frontend needs the backend URL.

---

## 0. One-time repo prep (do this before touching any provider)

### 0.1 Push code to GitHub

Both Render and Cloudflare Pages pull directly from GitHub, so the code must be there first.

```bash
cd /app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/shiv-sampada-parking.git
git push -u origin main
```

### 0.2 Add a `.gitignore` if you don't already have one

Create `/app/.gitignore`:

```
# env — never commit real secrets
backend/.env
frontend/.env
frontend/.env.local
frontend/.env.production

# python
__pycache__/
*.pyc
.venv/
venv/

# node
node_modules/
frontend/build/

# system
.DS_Store
```

Then untrack any secrets that slipped in:

```bash
git rm --cached backend/.env frontend/.env 2>/dev/null || true
git commit -am "Remove env from repo" && git push
```

### 0.3 Add SPA fallback for Cloudflare Pages

React Router needs every unknown path to serve `index.html`. Create `frontend/public/_redirects`:

```
/*    /index.html   200
```

Commit it — Cloudflare will honour this automatically.

### 0.4 Tighten CORS in the backend

The dev backend allows `*`. In production restrict it to your Cloudflare Pages URL. This is done **via env vars only** — no code change needed. See step 2.4 below.

### 0.5 Pin backend Python version (recommended)

Create `/app/backend/runtime.txt` so Render picks the right Python:

```
python-3.11.9
```

Commit and push.

---

## 1. MongoDB Atlas (Database)

### 1.1 Create a free cluster

1. Go to <https://cloud.mongodb.com> and sign up.
2. **Build a Cluster** → pick **M0 Free** (512 MB) → any region close to your users (e.g., AWS Mumbai for India) → *Create Deployment*.

### 1.2 Create a database user

1. Left sidebar → **Database Access** → *Add New Database User*.
2. Auth method: **Password**.
3. Username: `shivsampada` — copy it.
4. Password: click *Autogenerate* and **save it somewhere safe** (you can't see it again).
5. Built-in role: **Atlas admin** (fine for a small app; you can tighten later).
6. *Add User*.

### 1.3 Allow network access

1. Left sidebar → **Network Access** → *Add IP Address*.
2. For simplicity click **Allow Access from Anywhere** (`0.0.0.0/0`). Render's outbound IPs rotate, so whitelisting Render specifically is painful on the free tier.
3. *Confirm*.

> Security-wise this is OK because access still requires the DB username/password.

### 1.4 Grab the connection string

1. Left sidebar → **Database** → click **Connect** on your cluster → **Drivers** → *Python 3.6 or later*.
2. Copy the string; it looks like:
   ```
   mongodb+srv://shivsampada:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```
3. Replace `<db_password>` with the password from step 1.2. If the password contains special characters, URL-encode them (`@` → `%40`, etc.).

Keep this ready — you'll paste it into Render.

---

## 2. Render (Backend)

### 2.1 Create the Web Service

1. Go to <https://render.com> → sign in with GitHub → *New* → **Web Service**.
2. Connect the `shiv-sampada-parking` repo.
3. Configure:

   | Field | Value |
   | --- | --- |
   | **Name** | `shiv-sampada-api` (this becomes your subdomain) |
   | **Region** | Same as Atlas (e.g., Singapore) |
   | **Branch** | `main` |
   | **Root Directory** | `backend` |
   | **Runtime** | `Python 3` |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `uvicorn server:app --host 0.0.0.0 --port $PORT` |
   | **Instance Type** | `Free` |

   > `$PORT` is provided by Render — your app already reads `$PORT` because Uvicorn is started from the CLI.

4. **Don't click Create yet** — add env vars first (next step).

### 2.2 Add environment variables

Scroll to **Environment Variables** and add each of these:

| Key | Value | Notes |
| --- | --- | --- |
| `MONGO_URL` | *your Atlas connection string from 1.4* | Include the password |
| `DB_NAME` | `shiv_sampada` | Any name; Atlas creates it on first insert |
| `JWT_SECRET` | *64-char random hex* | Generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `ADMIN_FLAT` | `ADMIN` | Keep as `ADMIN` |
| `ADMIN_PASSWORD` | *pick a strong password* | This is **your** admin login |
| `CORS_ORIGINS` | *leave blank for now* | Fill in step 4 after Cloudflare gives you a URL |
| `PYTHON_VERSION` | `3.11.9` | Ensures a modern Python |

### 2.3 Deploy

Click **Create Web Service**. Render will build + deploy in ~3 minutes. Watch the log — you should see:

```
INFO:     Uvicorn running on http://0.0.0.0:10000
2026-... - root - INFO - Seeded admin user ADMIN
INFO:     Application startup complete.
```

Your API URL will be printed at the top, e.g., `https://shiv-sampada-api.onrender.com`. **Copy this URL.**

### 2.4 Smoke test

Open a terminal:

```bash
curl https://shiv-sampada-api.onrender.com/api/
# {"message":"Shiv Sampada Parking API"}

curl -X POST https://shiv-sampada-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"flat_number":"ADMIN","password":"<your_admin_password>"}'
# should return {"token":"...","user":{...,"is_admin":true}}
```

If both work, the backend is live. If not, check **Render → Logs**.

> **Free tier note:** Render Free spins the app down after 15 min of inactivity, causing a ~30 s cold start on the next request. Upgrade to the **Starter ($7/mo)** plan to keep it warm.

---

## 3. Cloudflare Pages (Frontend)

### 3.1 Create the project

1. Go to <https://dash.cloudflare.com> → **Workers & Pages** → *Create* → **Pages** → *Connect to Git*.
2. Authorize GitHub, pick the same repo.
3. Configure the build:

   | Field | Value |
   | --- | --- |
   | **Project name** | `shiv-sampada` (becomes `shiv-sampada.pages.dev`) |
   | **Production branch** | `main` |
   | **Framework preset** | `Create React App` |
   | **Build command** | `yarn build` |
   | **Build output directory** | `build` |
   | **Root directory** | `frontend` |

### 3.2 Add environment variables

Under **Environment variables (Production)** add:

| Key | Value |
| --- | --- |
| `REACT_APP_BACKEND_URL` | `https://shiv-sampada-api.onrender.com` (your Render URL, **no trailing slash**) |
| `CI` | `false` (prevents CRA from treating warnings as build errors) |
| `NODE_VERSION` | `20` |

### 3.3 Deploy

Click **Save and Deploy**. Build takes ~2 minutes. When it's done you'll get a URL like `https://shiv-sampada.pages.dev`.

**Copy this URL.**

---

## 4. Wire CORS back into the backend

Now that both URLs exist, tell the backend to trust the frontend.

1. Render → your service → **Environment** → edit `CORS_ORIGINS`:
   ```
   https://shiv-sampada.pages.dev
   ```
   (Add more origins comma-separated if you use a custom domain later, e.g. `https://shiv-sampada.pages.dev,https://parking.shivsampada.com`.)
2. Click **Save Changes**. Render will redeploy automatically (~1 min).

---

## 5. End-to-end verification

1. Open `https://shiv-sampada.pages.dev` on your phone.
2. Tap **Sign up**, register flat `302` with a test plate.
3. Confirm the card appears in **Directory**.
4. Open a *different* browser (or incognito) → search for that plate → tap **Call** → the phone dialer opens.
5. Sign in as `ADMIN` in your original browser → the **Admin** tab shows every card with Edit/Delete.

If all five work, deployment is complete. 🎉

---

## 6. Custom domain (optional)

### Frontend on your own domain (`parking.shivsampada.com`)

1. Cloudflare Pages → your project → **Custom domains** → *Set up a custom domain* → enter `parking.shivsampada.com`.
2. If your DNS is already on Cloudflare it's automatic; otherwise add the CNAME they show.
3. Add the new URL to `CORS_ORIGINS` on Render.

### Backend on your own domain (`api.shivsampada.com`)

1. Render → your service → **Settings** → *Custom Domains* → *Add Custom Domain*.
2. Add the CNAME they provide in your DNS.
3. Update `REACT_APP_BACKEND_URL` on Cloudflare Pages → redeploy.

---

## 7. Common issues

**`CORS error` in browser console**
`CORS_ORIGINS` on Render doesn't exactly match the frontend origin. Must be `https://...` with **no trailing slash**. Save + wait for Render to restart.

**`ECONNREFUSED` / API calls return 404**
`REACT_APP_BACKEND_URL` on Cloudflare wasn't set before the build. Re-run the deployment from the Cloudflare dashboard (**Deployments** → *Retry deployment*).

**Signup returns 500 or "server error"**
The Atlas password wasn't URL-encoded, or the DB user wasn't given read/write. Check Render logs — look for `pymongo.errors.OperationFailure`.

**First call is very slow (~30s)**
Render Free is asleep. Upgrade to Starter or ping the app on a schedule (e.g., a Cloudflare Cron Trigger hitting `/api/`).

**React Router 404 on refresh**
`frontend/public/_redirects` is missing. Add the one-line file from step 0.3 and redeploy.

**Login says "Invalid token"**
`JWT_SECRET` changed on Render — old tokens are invalidated. Users just sign in again. If this happens unintentionally, don't rotate the secret without warning.

---

## 8. Post-deploy checklist

- [ ] `.env` files are in `.gitignore` and not on GitHub
- [ ] `JWT_SECRET` on Render is unique and random (not the dev one)
- [ ] `ADMIN_PASSWORD` on Render is strong and only you know it
- [ ] `CORS_ORIGINS` on Render lists only your real frontend origin(s)
- [ ] Atlas Network Access is set to `0.0.0.0/0` **or** to Render's outbound IPs
- [ ] Atlas cluster region is close to your users
- [ ] A test flat can sign up, sign in, add a car, and call from the deployed URL
- [ ] Admin can log in and edit any card

---

## 9. Ongoing operations

**Updating the app**
Push to `main` — Render redeploys the backend, Cloudflare redeploys the frontend, both automatically.

**Rotating the admin password**
Change `ADMIN_PASSWORD` on Render → *Save Changes* → the startup hook rehashes it on the next boot.

**Viewing production data**
- Atlas UI → *Collections* — browse `users`, `vehicles`, `login_attempts`.
- Or the app's **Admin** tab (signed in as `ADMIN`).

**Backups**
Atlas M0 has continuous cloud backup for 2 days. For longer retention, upgrade to M10 or schedule `mongodump` via a cron.

---

That's it. Your society parking directory is now live at `https://shiv-sampada.pages.dev` (or your custom domain) with an Atlas-backed API on Render.
