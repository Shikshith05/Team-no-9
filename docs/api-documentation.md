# Personal Wealth Management – Backend API Documentation

## 1. Overview

The Personal Wealth Management backend provides REST APIs for managing financial assets, monitoring net worth, setting price alerts, and exporting reports.

**Base URL:** `http://localhost:5000`

**Technology:** Node.js, Express 5, PostgreSQL

**Content type:** `application/json` for JSON requests.

## 2. Authentication

Most API endpoints require authentication. Authentication is handled through JWT tokens.

### Authentication endpoints

| Method | Endpoint | Description | Authentication |
|---|---|---|---|
| POST | `/api/auth/register` | Register a new user | No |
| POST | `/api/auth/login` | Log in | No |
| POST | `/api/auth/logout` | Log out | Yes |
| POST | `/api/auth/forgot-password` | Request password reset | No |
| POST | `/api/auth/reset-password` | Reset password using token | No |

### Register

`POST /api/auth/register`

Request body:

```json
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "YourPassword"
}
```

Successful response: `201 Created`

```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "name": "Test User",
    "email": "test@example.com"
  }
}
```

### Login

`POST /api/auth/login`

Request body:

```json
{
  "email": "test@example.com",
  "password": "YourPassword"
}
```

Successful response: `200 OK`

Returns a JWT token and user information.

Security: Five failed login attempts lock the account for 15 minutes.

### Logout

`POST /api/auth/logout`

Requires authentication. Adds the current token to the token blacklist.

### Forgot password

`POST /api/auth/forgot-password`

Request body:

```json
{
  "email": "test@example.com"
}
```

Returns `202 Accepted` with a generic response, regardless of whether the account exists.

### Reset password

`POST /api/auth/reset-password`

Request body:

```json
{
  "token": "RESET_TOKEN",
  "password": "NewPassword"
}
```

A reset token expires after 30 minutes and can only be used once.

**Implementation note:** Email delivery is not yet implemented. In development, the reset link is written to the server console. In production, an email provider is required.

## 3. Asset Management APIs

All asset endpoints require authentication.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/assets` | Create an asset |
| GET | `/api/assets` | List assets |
| GET | `/api/assets/:id` | Retrieve an asset |
| PUT | `/api/assets/:id` | Update an asset |
| DELETE | `/api/assets/:id` | Soft-delete an asset |
| PUT | `/api/assets/:id/valuation` | Update manual valuation |
| GET | `/api/assets/dashboard-summary` | Get asset summary |

### Supported asset types

- `REAL_ESTATE`
- `GOLD`
- `STOCK`
- `CASH`

### Create asset

`POST /api/assets`

Example – Real estate:

```json
{
  "assetType": "REAL_ESTATE",
  "assetName": "Residential Property",
  "location": "Bengaluru",
  "purchaseValue": "5000000",
  "purchaseDate": "2025-01-15",
  "value": "6000000"
}
```

Example – Gold:

```json
{
  "assetType": "GOLD",
  "form": "JEWELLERY",
  "purityKarat": 22,
  "weightGrams": "50",
  "purchasePrice": "300000",
  "value": "350000"
}
```

Example – Stock:

```json
{
  "assetType": "STOCK",
  "ticker": "RELIANCE",
  "exchange": "NSE",
  "quantity": "10",
  "averageBuyPrice": "1200",
  "value": "15000"
}
```

Example – Cash:

```json
{
  "assetType": "CASH",
  "accountLabel": "Savings Account",
  "value": "100000"
}
```

Successful response: `201 Created`

```json
{
  "success": true,
  "data": {}
}
```

The `data` object contains the created asset record.

### List assets

`GET /api/assets`

Optional query parameters:

| Parameter | Description | Default |
|---|---|---|
| type | Filter by asset type | All types |
| page | Page number | 1 |
| limit | Number of records | 50 |

Maximum page limit: 200.

Example:

`GET /api/assets?type=GOLD&page=1&limit=50`

Response structure:

```json
{
  "items": [],
  "page": 1,
  "limit": 50,
  "total": 0
}
```

### Get an asset

`GET /api/assets/:id`

Example:

`GET /api/assets/1`

Returns the requested asset belonging to the authenticated user.

### Update an asset

`PUT /api/assets/:id`

Supports partial updates. Fields not supplied retain their existing values. The merged asset must satisfy the validation rules for its asset type.

### Delete an asset

`DELETE /api/assets/:id`

Uses soft deletion by setting the `deleted_at` timestamp.

Successful response:

```json
{
  "success": true,
  "message": "Asset soft-deleted successfully"
}
```

### Update manual valuation

`PUT /api/assets/:id/valuation`

Request body:

```json
{
  "value": "750000"
}
```

The value must be between 0 and 10,000,000,000.00, with at most two decimal places.

A successful update also creates a valuation history record.

STOCK and GOLD assets cannot be manually valued because their values are obtained from market prices.

### Asset dashboard summary

`GET /api/assets/dashboard-summary`

Returns asset allocation and total net worth information for the authenticated user.

## 4. Dashboard APIs

Both endpoints require authentication.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard` | Get dashboard information |
| GET | `/api/dashboard/trend` | Get net-worth trend |

### Dashboard overview

`GET /api/dashboard`

Returns:

- Net worth
- Currency
- Data timestamp
- Stale market data indicator
- Asset allocation

Currency: `INR`.

### Net-worth trend

`GET /api/dashboard/trend?range=1M`

Supported ranges:

| Range | Description |
|---|---|
| `1M` | One month |
| `6M` | Six months |
| `1Y` | Twelve months |
| `ALL` | All available history |

Response structure:

```json
{
  "range": "1M",
  "currency": "INR",
  "points": [
    {
      "date": "2026-11-01",
      "netWorth": "500000.00"
    }
  ]
}
```

## 5. Price Alert APIs

Both endpoints require authentication.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/alerts` | List alerts |
| POST | `/api/alerts` | Create an alert |

### Create alert

`POST /api/alerts`

Request body:

```json
{
  "assetType": "stock",
  "condition": "ABOVE",
  "targetPrice": "1500"
}
```

Supported asset types: `stock`, `gold`.

Supported conditions: `ABOVE`, `BELOW`.

Target price must be positive and contain at most two decimal places.

Successful response: `201 Created`.

### List alerts

`GET /api/alerts`

Returns the authenticated user's alerts, including target price, condition, triggered time and triggered value.

## 6. Report APIs

Both endpoints require authentication.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/reports/export/csv` | Export CSV report |
| GET | `/api/reports/export/pdf` | Export PDF report |

### CSV export

`GET /api/reports/export/csv`

Downloads:

`personal-wealth-report.csv`

The report includes asset records and valuation history.

### PDF export

`GET /api/reports/export/pdf`

Downloads:

`personal-wealth-report.pdf`

The report includes current assets and valuation history.

Both exports include only the authenticated user's active assets and their associated valuation records.

## 7. Valuation History API

Requires authentication.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/valuations/history` | Retrieve valuation history |

### Retrieve valuation history

`GET /api/valuations/history`

Optional query parameters:

| Parameter | Description | Default |
|---|---|---|
| assetId | Filter by asset ID | All assets |
| from | Start date (`YYYY-MM-DD`) | No restriction |
| to | End date (`YYYY-MM-DD`) | No restriction |
| page | Page number | 1 |
| limit | Records per page | 200 |

Maximum limit: 200.

Example:

`GET /api/valuations/history?assetId=1&from=2026-01-01&to=2026-11-30&page=1&limit=50`

Response structure:

```json
{
  "items": [],
  "page": 1,
  "limit": 50,
  "total": 0
}
```

Results are ordered by valuation date, newest first.

## 8. Health Check APIs

These endpoints are public.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Backend liveness |
| GET | `/api/health` | Backend and database readiness |

### Backend liveness

`GET /health`

Returns HTTP `200` with:

- success
- status
- uptime
- timestamp

### Database readiness

`GET /api/health`

Executes a database query to verify connectivity.

Successful response:

```json
{
  "status": "ok"
}
```

If the database is unavailable, returns HTTP `503 Service Unavailable`.

## 9. Asset Validation Rules

| Asset type | Required fields |
|---|---|
| REAL_ESTATE | assetName, location, purchaseValue, purchaseDate, value |
| GOLD | form, purityKarat, weightGrams, purchasePrice, value |
| STOCK | ticker, quantity, averageBuyPrice, value |
| CASH | accountLabel, value |

Additional rules:

- Gold forms: `JEWELLERY`, `COIN`, `BAR`.
- Gold purity: 1–24 karat. Values such as `22K` are accepted.
- Stock exchanges: `NSE`, `BSE`.
- Stock exchange defaults to `NSE` when omitted.
- Stock ticker: 1–20 permitted letters, digits or symbols (`&`, `-`, `.`).
- Monetary values must be non-negative and respect their field-specific decimal precision.
- Weight and quantity must be positive.
- Purchase dates must use `YYYY-MM-DD`.
- Asset-specific fields that do not apply to an asset type are stored as `null`.

## 10. Security and Error Handling

- JWT authentication protects private endpoints.
- Users can access only their own assets and associated records.
- Passwords are hashed using bcrypt.
- Login attempts are rate-limited and account lockout is enforced.
- Helmet is used for HTTP security headers.
- CORS is configured through `FRONTEND_ORIGIN`.
- API errors are handled through centralized error middleware.
- Unknown API routes are handled by the API not-found middleware.
- Report exports use `Cache-Control: no-store`.

---

**API documentation status:** Prepared from the backend route files, controllers, application configuration and asset validation implementation.