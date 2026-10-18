// App frame: top bar with the product name and main navigation.
// Nav items other than Dashboard are placeholders until those screens exist (SAD 4.8).
const NAV = [
  { label: 'Dashboard', href: '#', current: true },
  { label: 'Assets', href: '#' },
  { label: 'Reports', href: '#' },
  { label: 'Settings', href: '#' },
];

export default function AppShell({ children }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#">
            <span className="brand-mark" aria-hidden="true">₹</span>
            <span>Wealth</span>
          </a>
          <nav aria-label="Main">
            <ul className="nav">
              {NAV.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className={item.current ? 'nav-link current' : 'nav-link'}
                    aria-current={item.current ? 'page' : undefined}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
