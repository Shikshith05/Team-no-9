
import { logout } from '../api/auth.js';

const NAV = [
  { label: 'Dashboard', href: '#/' },
  { label: 'Assets', href: '#/assets' },
  { label: 'Reports', href: '#/reports' },
  { label: 'Settings', href: '#/settings' },
];

export default function AppShell({ children, current, variant }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#/">
            <span className="brand-mark" aria-hidden="true">₹</span>
            <span>Wealth</span>
          </a>

          {variant !== 'auth' && (
            <nav aria-label="Main">
              <ul className="nav">
                {NAV.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className={item.label === current ? 'nav-link current' : 'nav-link'}
                      aria-current={item.label === current ? 'page' : undefined}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}

                <li>
                  <button
                    type="button"
                    className="button"
                    onClick={logout}
                  >
                    Logout
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </div>
      </header>

      {children}
    </div>
  );
}
