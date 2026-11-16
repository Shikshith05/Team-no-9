# Team-no-9 – Frontend Development and Testing Guide

## 1. Overview

The frontend of Team-no-9 is built using **React 19** and **Vite**. It provides the user interface for the application, including authentication, dashboard, asset management, and financial trend features.

The frontend supports unit testing with Vitest and browser-based end-to-end testing with Playwright.

## 2. Technologies Used

- React 19
- React DOM
- Vite
- Vitest
- Playwright
- React Testing Library
- Oxlint
- JavaScript

## 3. Prerequisites

Before setting up the frontend, install:

- Node.js
- npm
- Git
- Chromium browser (for Playwright tests)

## 4. Installation and Setup

Navigate to the frontend directory:

```bash
cd frontend
```

Install the required dependencies:

```bash
npm install
```

## 5. Running the Frontend

Start the development server:

```bash
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

During development, API requests beginning with `/api` are forwarded to the backend running at:

```text
http://localhost:5000
```

## 6. Available NPM Commands

Run these commands from the `frontend` directory.

| Command | Description |
|---|---|
| `npm run dev` | Starts the Vite development server |
| `npm test` | Runs unit tests using Vitest |
| `npm run lint` | Checks code using Oxlint |
| `npm run build` | Creates the production build |
| `npm run preview` | Previews the production build |
| `npm run test:e2e` | Runs Playwright tests using mock data |
| `npm run test:e2e:real` | Runs Playwright tests against the real backend |

## 7. Unit Testing with Vitest

The project uses **Vitest** for frontend unit testing.

The test configuration is defined in `vite.config.js` and includes:

```text
src/**/*.test.{js,jsx}
```

Run all frontend unit tests:

```bash
npm test
```

The unit tests cover:

- API authentication and HTTP utilities
- Asset form functionality
- Dashboard functionality
- Routing
- Trend calculations
- Validation
- Authentication pages
- Dashboard and asset pages
- Password reset pages

Unit test files are organized under:

```text
src/
├── api/
├── lib/
└── pages/
```

## 8. End-to-End Testing with Playwright

The project uses Playwright for browser-based end-to-end testing.

There are two separate test configurations.

### 8.1 Mock-Data Browser Tests

The mock-data tests are located in:

```text
e2e/
```

They cover:

- Asset management
- Authentication
- Dashboard
- Navigation
- Financial trends

First, install the Playwright Chromium browser if required:

```bash
npx playwright install chromium
```

Run the tests:

```bash
npm run test:e2e
```

The configuration automatically:

1. Builds the frontend.
2. Starts Vite Preview on port `4173`.
3. Enables mock API mode using `VITE_USE_MOCK_API=true`.
4. Runs browser tests using Desktop Chrome.

### 8.2 Real-Backend Browser Tests

The real-backend tests are located in:

```text
e2e-real/
```

They cover:

- Asset management
- Dashboard
- User journeys
- Password reset

These tests require both the backend and frontend servers to be running.

**Step 1: Start the backend**

Open a terminal:

```bash
cd backend
npm run dev
```

**Step 2: Start the frontend**

Open another terminal:

```bash
cd frontend
npm run dev
```

**Step 3: Run real-backend tests**

Open a third terminal:

```bash
cd frontend
npm run test:e2e:real
```

By default, the real-backend tests use:

```text
http://localhost:5173
```

For testing through the Docker development gateway, configure the base URL as `https://localhost`.

In Windows CMD, run:

```cmd
set E2E_BASE_URL=https://localhost
npm run test:e2e:real
```

The real-backend configuration uses one worker and allows the development gateway's self-signed HTTPS certificate.

## 9. Project Structure

```text
frontend/
├── e2e/
│   ├── assets.spec.js
│   ├── auth.spec.js
│   ├── dashboard.spec.js
│   ├── navigation.spec.js
│   ├── trend.spec.js
│   └── helpers.js
│
├── e2e-real/
│   ├── assets.spec.js
│   ├── dashboard.spec.js
│   ├── journey.spec.js
│   └── passwordReset.spec.js
│
├── src/
│   ├── api/
│   ├── lib/
│   └── pages/
│
├── playwright.config.js
├── playwright.real.config.js
├── vite.config.js
├── package.json
└── README.md
```

## 10. Code Quality and Production Build

Run Oxlint to check the frontend code:

```bash
npm run lint
```

Create the production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## 11. Troubleshooting

### Playwright browser is missing

Install Chromium:

```bash
npx playwright install chromium
```

### Backend API requests are failing

Make sure the backend server is running on port `5000`.

### Real-backend tests cannot connect

Verify that both frontend and backend development servers are running before executing:

```bash
npm run test:e2e:real
```

### Port is already in use

Stop the process using the required port before restarting the development server.

### Dependencies are missing

Run:

```bash
npm install
```

## 12. Important Notes

- Run frontend npm commands from the `frontend` directory.
- Vitest is used for unit testing.
- Playwright is used for browser-based end-to-end testing.
- Mock-data and real-backend tests use separate configurations.
- Real-backend browser tests require the backend to be started manually.
- The frontend development server uses Vite.

---

**Team-no-9 – Frontend Development and Testing Guide**