// Screens are chosen from the URL hash (#/, #/login, ...); see lib/router.js.
import { Fragment, useEffect, useRef } from 'react';
import AppShell from './components/AppShell.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AssetsPage from './pages/AssetsPage.jsx';
import ValuationPage from './pages/ValuationPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
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
  { path: '/reports', title: 'Reports', nav: 'Reports', render: () => <PlaceholderPage title="Reports" /> },
  { path: '/settings', title: 'Settings', nav: 'Settings', render: () => <PlaceholderPage title="Settings" /> },
  { path: '/login', title: 'Log in', layout: 'auth', render: () => <LoginPage /> },
];

const NOT_FOUND = { title: 'Page not found', render: () => <NotFoundPage /> };

export default function App() {
  const location = useHashLocation();
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

  useEffect(() => {
    document.title = `${route.title} · Personal Wealth Management`;
  }, [route.title]);

  // After moving to another screen, start at the top and put focus on its heading
  // so keyboard and screen-reader users know the page changed.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    document.querySelector('main h1')?.focus();
  }, [location.path]);

  return (
    <AppShell variant={route.layout} current={route.nav}>
      <Fragment key={location.path}>{route.render({ params, query: location.query })}</Fragment>
    </AppShell>
  );
}
