import AppShell from './components/AppShell.jsx';
import Dashboard from './pages/Dashboard.jsx';

// Routing (assets, reports, settings) comes later; for now the dashboard is the home screen.
export default function App() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}
