import { discoverNewsletters } from '@/lib/newsletter-engine';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function Home() {
  const newsletters = discoverNewsletters();

  const grouped: Record<string, typeof newsletters> = {};
  for (const n of newsletters) {
    if (!grouped[n.folder]) grouped[n.folder] = [];
    grouped[n.folder].push(n);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f2f3f2' }}>
      <header
        style={{
          background: '#1a1a2e',
          color: '#fff',
          padding: '32px 40px',
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Newsletter Preview</h1>
        <p style={{ fontSize: 14, opacity: 0.7, margin: 0 }}>
          Select a newsletter to preview. Push new newsletter folders to the repo and redeploy to
          add more.
        </p>
      </header>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
          padding: '32px 40px',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        {Object.entries(grouped).map(([folder, items]) =>
          items.map((n) => {
            const name = n.slug
              .replace('pe-newsletter-', '')
              .replace(/(\d{2})$/, ' 20$1')
              .replace(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, (m) =>
                m.charAt(0).toUpperCase() + m.slice(1)
              );

            return (
              <div
                key={`${folder}/${n.slug}`}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  padding: 24,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: '#606366',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  {folder}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#383b3e',
                    marginBottom: 16,
                    textTransform: 'capitalize',
                  }}
                >
                  {name}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Link
                    href={`/preview/${folder}/${n.slug}?lang=en`}
                    style={{
                      display: 'inline-block',
                      padding: '8px 20px',
                      borderRadius: 4,
                      fontSize: 14,
                      fontWeight: 600,
                      textDecoration: 'none',
                      background: '#8b1d41',
                      color: '#fff',
                    }}
                  >
                    English
                  </Link>
                  <Link
                    href={`/preview/${folder}/${n.slug}?lang=fr`}
                    style={{
                      display: 'inline-block',
                      padding: '8px 20px',
                      borderRadius: 4,
                      fontSize: 14,
                      fontWeight: 600,
                      textDecoration: 'none',
                      background: '#f2f3f2',
                      color: '#383b3e',
                    }}
                  >
                    French
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
