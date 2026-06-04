const structure = [
  'apps/api/src/main.ts',
  'apps/api/src/app.module.ts',
  'apps/api/src/auth/*',
  'apps/web/app/layout.tsx',
  'apps/web/app/page.tsx',
  'apps/web/components/*',
  'apps/web/lib/theme.ts',
];

export function StructureOverview() {
  return (
    <section className="structure-section" id="project-structure">
      <div>
        <span className="section-label">Project structure</span>
        <h2>Monorepo-ready layout for API and web apps.</h2>
        <p>
          The workspace is organized for quick iteration now and an easy move to shared packages later.
        </p>
      </div>
      <div className="structure-card">
        {structure.map((item) => (
          <code key={item}>{item}</code>
        ))}
      </div>
    </section>
  );
}
