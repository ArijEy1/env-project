const authEndpoints = [
  'POST /api/auth/register',
  'POST /api/auth/login',
  'GET /api/auth/me',
];

const loginExample = `{
  "email": "admin@environment.gov",
  "password": "strong-password"
}`;

export function AuthShowcase() {
  return (
    <section className="auth-showcase">
      <div className="auth-card">
        <span className="section-label">Authentication</span>
        <h2>JWT flow ready for the first protected features.</h2>
        <p>
          The API already exposes register, login and profile routes. User IDs are generated
          with `uuid`, and passwords are hashed before storage in the current starter service.
        </p>
        <div className="auth-pill-row">
          {authEndpoints.map((endpoint) => (
            <span key={endpoint} className="auth-pill">
              {endpoint}
            </span>
          ))}
        </div>
        <ul className="auth-list">
          <li>JWT bearer token strategy with protected `me` route</li>
          <li>Validation DTOs for register and login payloads</li>
          <li>In-memory user store that is easy to swap for a database</li>
        </ul>
        <div className="hero-actions auth-cta-row">
          <a className="primary-btn" href="/register">
            Open register page
          </a>
          <a className="secondary-btn" href="/login">
            Open login page
          </a>
        </div>
      </div>

      <div className="auth-code">
        <h3>Login payload example</h3>
        <pre>{loginExample}</pre>
      </div>
    </section>
  );
}