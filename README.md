# Shiv Sampada Parking

A mobile-first web app for a housing society to help members find and call the owner of a car that is blocking them in. Members register their contact + vehicle details, and anyone can search by license plate and tap-to-call.

Stack: **React (CRA) + FastAPI + MongoDB**.

---

## Repo layout

```
/app
├── backend/          FastAPI app (server.py)
│   ├── server.py
│   ├── requirements.txt
│   └── .env
├── frontend/         React app
│   ├── src/
│   ├── package.json
│   └── .env
└── README.md
```

---

## Run locally in VS Code

### 1. Prerequisites

Install these on your machine first:

| Tool | Version | Check |
| --- | --- | --- |
| Python | 3.10+ | `python3 --version` |
| Node.js | 18+ | `node --version` |
| Yarn (classic) | 1.22+ | `yarn --version` |
| MongoDB Community | 6.0+ | `mongod --version` |
| VS Code | latest | — |

Recommended VS Code extensions:
- **Python** (ms-python.python)
- **ESLint** (dbaeumer.vscode-eslint)
- **Tailwind CSS IntelliSense** (bradlc.vscode-tailwindcss)
- **MongoDB for VS Code** (mongodb.mongodb-vscode)

### 2. Clone and open

```bash
git clone <your-repo-url> shiv-sampada-parking
code shiv-sampada-parking
```

### 3. Start MongoDB

Open a **VS Code terminal** (`Ctrl` + `` ` ``) and start MongoDB:

- **macOS (Homebrew):** `brew services start mongodb-community`
- **Windows:** MongoDB installer registers a service — start it from *Services*, or run `net start MongoDB`.
- **Linux (systemd):** `sudo systemctl start mongod`
- **Or run in a shell directly:** `mongod --dbpath /path/to/data`

Confirm it's reachable on `mongodb://localhost:27017`.

### 4. Backend setup

Open a new VS Code terminal.

```bash
cd backend

# create a virtualenv
python3 -m venv .venv

# activate it
# macOS/Linux
source .venv/bin/activate
# Windows PowerShell
.venv\Scripts\Activate.ps1

# install deps
pip install -r requirements.txt
```

Check `backend/.env` — it must contain:

```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="shiv_sampada"
CORS_ORIGINS="http://localhost:3000"
```

> Do **not** commit real secrets. `DB_NAME` can be any name — the app will create it on first insert.

Start the API:

```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

The API is now at **http://localhost:8001**. Sanity check:

```bash
curl http://localhost:8001/api/
# {"message":"Shiv Sampada Parking API"}
```

Interactive docs: **http://localhost:8001/docs**.

### 5. Frontend setup

Open a **second** VS Code terminal.

```bash
cd frontend
yarn install
```

Edit `frontend/.env` for local dev:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=0
```

> `WDS_SOCKET_PORT=0` avoids CRA hot-reload websocket warnings on localhost.

Start the dev server:

```bash
yarn start
```

The app opens at **http://localhost:3000**.

### 6. Try it

1. Tap **Add**, fill in owner name, phone, flat and vehicle number.
2. Go to **Search** and type any part of a plate — matching cards appear.
3. Tap the green **Call** button — it opens your OS dialer (on desktop it prompts to launch a registered handler; on mobile it opens the phone app directly).

---

## Recommended VS Code launch config

Create `.vscode/launch.json` to run/debug both apps with one click:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Backend: FastAPI",
      "type": "debugpy",
      "request": "launch",
      "module": "uvicorn",
      "args": ["server:app", "--reload", "--port", "8001"],
      "cwd": "${workspaceFolder}/backend",
      "python": "${workspaceFolder}/backend/.venv/bin/python"
    },
    {
      "name": "Frontend: React",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "yarn",
      "runtimeArgs": ["start"],
      "cwd": "${workspaceFolder}/frontend",
      "console": "integratedTerminal"
    }
  ],
  "compounds": [
    { "name": "Run All", "configurations": ["Backend: FastAPI", "Frontend: React"] }
  ]
}
```

Run **Run All** from the Run & Debug panel to boot both.

---

## API reference (local)

Base URL: `http://localhost:8001/api`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Health check |
| GET | `/vehicles` | List all (optional `?search=<partial-plate>`) |
| POST | `/vehicles` | Create vehicle |
| GET | `/vehicles/{id}` | Fetch one |
| PUT | `/vehicles/{id}` | Update |
| DELETE | `/vehicles/{id}` | Remove |
| GET | `/stats` | `{total_vehicles: N}` |

Vehicle payload:

```json
{
  "owner_name": "Rakesh Sharma",
  "phone": "+91 98765 43210",
  "flat_number": "B-402",
  "vehicle_number": "MH 01 AB 1234"
}
```

Plate uniqueness is case- and space-insensitive (duplicates return `409`).

---

## Common issues

**`ECONNREFUSED` on API call from frontend**
Make sure the backend is running on port 8001 and `frontend/.env` has `REACT_APP_BACKEND_URL=http://localhost:8001`. Restart `yarn start` after editing `.env`.

**`pymongo.errors.ServerSelectionTimeoutError`**
MongoDB isn't running or `MONGO_URL` is wrong. See step 3.

**CORS errors in browser console**
Add your frontend origin to `CORS_ORIGINS` in `backend/.env` (comma-separated) and restart the backend.

**Call button does nothing on desktop**
Desktop browsers only open a dialer if one is registered (FaceTime on macOS, Phone Link on Windows). On a real phone the OS dialer opens directly.

**Port 3000 / 8001 already in use**
Kill the process or run on a different port:
```bash
# frontend on 3001
PORT=3001 yarn start
# backend on 8002
uvicorn server:app --reload --port 8002
```
(Then update `REACT_APP_BACKEND_URL` accordingly.)

---

## Production build

```bash
# frontend static bundle
cd frontend && yarn build     # outputs frontend/build

# backend as a service
cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2
```

Serve `frontend/build` behind any static host / CDN and point it at your public backend URL via `REACT_APP_BACKEND_URL` at build time.
