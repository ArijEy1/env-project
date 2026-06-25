'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page-shell" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px' }}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <h1 style={{ color: 'var(--white)', marginBottom: 10 }}>حدث خطأ غير متوقع</h1>
        <p style={{ color: 'rgba(245, 240, 230, 0.75)', marginBottom: 22 }}>
          نعتذر، حدث خطأ ما أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="primary-btn" onClick={() => reset()} type="button">إعادة المحاولة</button>
          <a className="secondary-btn" href="/">العودة للرئيسية</a>
        </div>
      </div>
    </main>
  );
}
