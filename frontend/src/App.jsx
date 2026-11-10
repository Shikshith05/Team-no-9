
import { Fragment, useEffect, useRef } from 'react';
import AppShell from './components/AppShell.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AssetsPage from './pages/AssetsPage.jsx';
import ValuationPage from './pages/ValuationPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import { USE_MOCK } from './api/mock.js';
import { hasSession } from './api/session.js';
import { matchPath, useHashLocation } from './lib/router.js';

const ROUTES = [
  { path: '/', title: 'Dashboard', nav: 'Dashboard', render: () => <Dashboard /> },
  { path: '/assets', title: 'Assets', nav: 'Assets', render: () => <AssetsPage /> },
  {
    path: '/assets/:id/valuation',
    title: 'Update property value',
    nav: 'Assets',
    render: ({ params }) => <ValuationPage assetId={params.id} />,
  },
  {
    path: '/assets/:id/history',
    title: 'Valuation history',
    nav: 'Assets',
    render: ({ params }) => <HistoryPage assetId={params.id} />,
  },
  { path: '/reports', title: 'Reports', nav: 'Reports', render: () => <ReportsPage /> },
  { path: '/login', title: 'Log in', layout: 'auth', render: () => <LoginPage /> },
  { path: '/register', title: 'Register', layout: 'auth', render: () => <RegisterPage /> },
  { path: '/forgot-password', title: 'Reset your password', layout: 'auth', render: () => <ForgotPasswordPage /> },
  {
    path: '/reset-password',
    title: 'Choose a new password',
    layout: 'auth',
    render: ({ query }) => <ResetPasswordPage token={query.get('token') ?? ''} />,
  },
];

const NOT_FOUND = { title: 'Page not found', render: () => <NotFoundPage /> };

export default function App() {
  const location = useHashLocation();
  const isAuthenticated = hasSession();

  const isPublicPath = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
  ].includes(location.path);

  let route = NOT_FOUND;
  let params = {};

  for (const candidate of ROUTES) {
    const match = matchPath(candidate.path, location.segments);
    if (match) {
      route = candidate;
      params = match;
      break;
    }
  }

  const mustLogIn = !USE_MOCK && !isAuthenticated && !isPublicPath;

  useEffect(() => {
    if (mustLogIn) {
      window.location.hash = '#/login';
    } else if (!USE_MOCK && isAuthenticated && location.path === '/login') {
      window.location.hash = '#/';
    }
  }, [mustLogIn, isAuthenticated, location.path]);

  const displayRoute = mustLogIn
    ? ROUTES.find((item) => item.path === '/login')
    : route;

  useEffect(() => {
    document.title = `${displayRoute.title} · Personal Wealth Management`;
  }, [displayRoute.title]);

  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    window.scrollTo(0, 0);
    document.querySelector('main h1')?.focus();
  }, [location.path]);

  const screenKey = `${location.path}?${location.query}`;

  return (
    <AppShell variant={displayRoute.layout} current={displayRoute.nav}>
      <Fragment key={screenKey}>
        {displayRoute.render({ params, query: location.query })}
      </Fragment>
    </AppShell>
  );
}
