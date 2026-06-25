export default function NotFound() {
  return (
    <main className="page-shell" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px' }}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <h1 style={{ color: 'var(--white)', marginBottom: 10 }}>الصفحة غير موجودة</h1>
        <p style={{ color: 'rgba(245, 240, 230, 0.75)', marginBottom: 22 }}>
          عذرًا، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
        <a className="primary-btn" href="/">العودة للرئيسية</a>
      </div>
    </main>
  );
}
