const highlights = [
  'Secure JWT authentication flow',
  'UUID-based user identifiers',
  'Clean App Router structure',
  'Nature-inspired visual system',
];

export function Hero() {
  return (
    <section className="hero-shell">
      <div className="hero-copy">
        <span className="eyebrow">National Environment Platform</span>
        <h1>Build a trusted digital ecosystem for environmental initiatives.</h1>
        <p>
          This starter combines `Next.js` and `NestJS` with a calm, official theme inspired
          by the provided launch image: deep teal, natural green and warm sand accents.
        </p>
        <div className="hero-actions">
          <a className="primary-btn" href="/register">
            Create account
          </a>
          <a className="secondary-btn" href="/login">
            Login
          </a>
          <a className="secondary-btn" href="#project-structure">
            View structure
          </a>
        </div>
      </div>

      <div className="hero-panel">
        <div className="hero-badge">Theme palette</div>
        <div className="palette-grid">
          <div className="palette-chip chip-midnight">Midnight</div>
          <div className="palette-chip chip-emerald">Emerald</div>
          <div className="palette-chip chip-forest">Forest</div>
          <div className="palette-chip chip-sand">Sand</div>
        </div>
        <ul className="highlight-list">
          {highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
