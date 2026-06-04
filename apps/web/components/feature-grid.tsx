const features = [
  {
    title: 'Backend auth foundation',
    description:
      'NestJS module with register, login and protected profile endpoints using JWT bearer tokens.',
  },
  {
    title: 'UUID identities',
    description:
      'Users are created with `uuid` identifiers, ready to plug into a database later.',
  },
  {
    title: 'Frontend launchpad',
    description:
      'Next.js App Router structure with reusable components and a ready-made visual direction.',
  },
];

export function FeatureGrid() {
  return (
    <section className="feature-grid" id="auth-module">
      {features.map((feature) => (
        <article key={feature.title} className="feature-card">
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
        </article>
      ))}
    </section>
  );
}
