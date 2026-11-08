# Personal Wealth Management

A web app for tracking a personal portfolio of real estate, gold, stocks and cash in one dashboard, with net worth, allocation and history. SE mini project by Team 9.

- **Backend:** Node.js 22, Express 5, PostgreSQL (`backend/`)
- **Frontend:** React 19, Vite (`frontend/`)
- **Specs:** `Team9_SRS_*.pdf`, `Team9_*_SAD.pdf`, `Team9_*_STP.pdf`
- **More docs:** [bug log](docs/bug-log.md), [auth decision](docs/auth-decision.md), [responsive test log](docs/responsive-test-log.md)

There are two ways to run it: [locally](#run-locally) for development, or [with Docker](#run-with-docker) for the full setup behind HTTPS.

## Run locally

You need Node.js 18 or newer (CI uses 22) and PostgreSQL 14 or newer. Run all commands from the repository root unless a step says otherwise.

### 1. Create the database

In `psql`, as a PostgreSQL superuser (`psql -U postgres`):

```sql
CREATE ROLE pwm LOGIN PASSWORD 'choose_a_password' CREATEDB;
CREATE DATABASE pwm_app OWNER pwm;
```

`CREATEDB` is only needed to run the backend tests.

### 2. Create `.env`

```bash
cp .env.example .env              # bash
Copy-Item .env.example .env       # PowerShell
```

Set `POSTGRES_PASSWORD` to the password you just chose. The rest of the file works as it is for local development. `.env` is ignored by git, so never commit it.

### 3. Apply the migrations

They must run in filename order.

**bash**

```bash
export PGPASSWORD=choose_a_password
for f in backend/database/migrations/*.sql; do
  psql -h localhost -U pwm -d pwm_app -v ON_ERROR_STOP=1 -f "$f" || break
done
```

**PowerShell**

```powershell
$env:PGPASSWORD = "choose_a_password"
Get-ChildItem backend\database\migrations\*.sql | Sort-Object Name | ForEach-Object {
  psql -h localhost -U pwm -d pwm_app -v ON_ERROR_STOP=1 -f $_.FullName
  if ($LASTEXITCODE -ne 0) { throw "Migration failed: $($_.Name)" }
}
```

Run the same loop again after pulling new migrations. They are safe to re-run.

### 4. Start the backend and frontend

```bash
cd backend && npm ci && npm run dev      # http://localhost:5000
cd frontend && npm ci && npm run dev     # http://localhost:5173, in a second terminal
```

Open <http://localhost:5173> and register an account. Vite forwards `/api` to the backend on port 5000.

## Run the tests

### Backend

The backend tests run against a real PostgreSQL database. `POSTGRES_DB` **must end in `_test`, because the tests drop and recreate it**. The user needs `CREATEDB`. Don't set `DEV_POSTGRES_DB` while testing.

The values below override `.env` for this one run.

**bash**

```bash
cd backend
npm ci
DB_HOST=localhost DB_PORT=5432 POSTGRES_USER=pwm POSTGRES_PASSWORD=choose_a_password POSTGRES_DB=pwm_app_test npm test
```

**PowerShell**

```powershell
cd backend
npm ci
$env:POSTGRES_USER = "pwm"; $env:POSTGRES_PASSWORD = "choose_a_password"; $env:POSTGRES_DB = "pwm_app_test"
npm test
```

### Frontend

```bash
cd frontend
npm ci
npm test          # unit tests
npm run lint
npm run build
```

Browser tests need Chromium once: `npx playwright install chromium`.

```bash
npm run test:e2e        # screens at 360, 768 and 1280 px, with mock data
npm run test:e2e:real   # full journey with no mocks; the backend and frontend must be running
```

## Run with Docker

This runs the setup from SAD 4.9: an nginx gateway with TLS, the API and PostgreSQL. **Only the gateway publishes ports** (80 redirects to 443). Migrations are applied each time the backend starts, in filename order, and each one runs once.

### 1. Create `.env`

Copy `.env.example` to `.env`, then change these values. The API refuses to start with the placeholder `JWT_SECRET`.

```ini
JWT_SECRET=<output of: openssl rand -hex 32>
POSTGRES_PASSWORD=<a strong password>
FRONTEND_ORIGIN=https://localhost
```

### 2. Create a development certificate

The certificate goes in `./certs`, which is ignored by git. Never commit keys.

**bash (including Git Bash on Windows)**

```bash
bash scripts/gen-dev-certs.sh
```

**PowerShell, using Docker so openssl need not be installed**

```powershell
New-Item -ItemType Directory -Force certs | Out-Null
docker run --rm -v "${PWD}/certs:/certs" alpine/openssl req -x509 -nodes -newkey rsa:2048 -days 365 -keyout /certs/privkey.pem -out /certs/fullchain.pem -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

For a real deployment, put your CA's `fullchain.pem` and `privkey.pem` in `./certs` instead.

### 3. Start it

```bash
docker compose up -d --build
docker compose ps                     # wait until every service is "healthy"
curl -k https://localhost/api/health  # {"status":"ok"}
```

Open <https://localhost> and accept the browser's warning about the self-signed certificate.

To stop it, run `docker compose down`. Adding `-v` also **deletes the database volume**.

## Configuration

All settings come from environment variables, and secrets never go in the repository. See [.env.example](.env.example).

| Variable | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | none (required) | Signs login tokens. The backend won't start without it. |
| `JWT_EXPIRES_IN` | `24h` | Login lifetime: `24h`, `30m`, `7d`, or a number of seconds. |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | The only browser origin CORS allows. |
| `DB_HOST`, `DB_PORT` | `127.0.0.1`, `5432` | PostgreSQL address. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | none (required) | PostgreSQL login and database. |
| `DEV_POSTGRES_DB` | unset | If set, the backend uses this database instead of `POSTGRES_DB`. |
| `STOCK_PRICE_API_URL`, `GOLD_PRICE_API_URL` | unset | Price feeds (https only). The refresh scheduler starts only when both are set. |
| `VITE_USE_MOCK_API` | unset | Frontend build: `true` uses mock data instead of the API. |

## Troubleshooting

| What you see | Cause and fix |
|---|---|
| Backend exits with `JWT_SECRET must be set` | No `JWT_SECRET` in `.env`, or `.env` is not in the repository root. |
| `password authentication failed` | `POSTGRES_USER` or `POSTGRES_PASSWORD` in `.env` doesn't match the role from step 1. |
| Login or other requests answer 500 and the log says a relation does not exist | Migrations were not applied. Run step 3 again. |
| Tests stop with `POSTGRES_DB must be a dedicated test database` | Use a name ending in `_test`. |
| Docker: `required variable ... is missing a value` | Fill in that value in `.env`. |
| Docker: the gateway keeps restarting and its log says `cannot load certificate` | Create the certificate (step 2), then run `docker compose up -d --force-recreate gateway`. |
