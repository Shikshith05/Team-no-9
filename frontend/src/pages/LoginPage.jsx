// Placeholder login screen until the auth API (register / login) is merged.
// The "Please log in again" message links here.
export default function LoginPage() {
  return (
    <main className="page auth-page">
      <div className="card auth-card">
        <h1 tabIndex={-1}>Log in</h1>
        <p className="muted">Logging in will work once the authentication API is merged.</p>
      </div>
    </main>
  );
}
