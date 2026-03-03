import { discoverNewsletters, renderNewsletter, compileScss } from '@/lib/newsletter-engine';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ folder: string; slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}

export default async function PreviewPage({ params, searchParams }: Props) {
  const { folder, slug } = await params;
  const { lang = 'en' } = await searchParams;
  const newsletters = discoverNewsletters();
  const newsletter = newsletters.find((n) => n.folder === folder && n.slug === slug);
  if (!newsletter) notFound();

  const body = renderNewsletter(newsletter, lang);
  if (!body) notFound();

  const css = compileScss(newsletter);

  const pageStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Open Sans', Arial, sans-serif; background: #e8e8e8; color: #383b3e; }
    a { color: #8b1d41; text-decoration: none; cursor: pointer; }
    a:hover { text-decoration: underline; }
    sup { vertical-align: super; font-size: 0.75em; line-height: 0; }
    .pe-wrapper { max-width: 800px; margin: 0 auto; background: #fff; }
    .pe-header-container { max-width: 800px; margin: 0 auto; }
    .pe-logo { display: block; width: 100%; max-width: 800px; height: auto; }
    .pe-hero { background: #8b1d41; padding: 40px; }
    .pe-hero-content { color: #fff; }
    .pe-hero-edition { font-size: 12px; letter-spacing: 3px; font-weight: 400; margin-bottom: 4px; }
    .pe-hero-title { font-size: 42px; font-weight: 700; margin-bottom: 2px; }
    .pe-hero-subtitle { font-size: 14px; font-weight: 400; }
    .pe-footer { background: #f2f3f2; padding: 30px 40px 40px; }
    .pe-rating { margin-bottom: 24px; }
    .pe-rating-q { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
    .pe-rating-scale { display: flex; gap: 8px; margin-bottom: 4px; }
    .pe-rating-circle { width: 32px; height: 32px; border-radius: 50%; border: 2px solid #8b1d41; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: #8b1d41; cursor: pointer; }
    .pe-rating-labels { display: flex; justify-content: space-between; font-size: 11px; color: #606366; max-width: 200px; }
    .pe-source { font-size: 11px; line-height: 1.4; color: #606366; margin-bottom: 16px; }
    .pe-source a { font-size: 11px; color: #606366; }
    .pe-offer-notes p { font-size: 11px; line-height: 1.3; color: #606366; margin-bottom: 10px; }
    .pe-offer-notes a { font-size: 11px; color: #606366; }
    .pe-social { display: flex; justify-content: flex-end; gap: 8px; margin: 20px 0; }
    .pe-social img { height: 22px; width: auto; }
    .pe-legal { font-size: 11px; line-height: 1.3; color: #606366; }
    .pe-legal p { margin-bottom: 12px; }
    .pe-legal a { color: #606366; font-size: 11px; }
    .preview-toolbar { position: sticky; top: 0; z-index: 100; background: #1a1a2e; color: #fff; padding: 10px 20px; display: flex; align-items: center; gap: 16px; font-size: 14px; }
    .preview-toolbar a { color: #fff; opacity: 0.8; font-weight: 500; font-size: 13px; text-decoration: none; }
    .preview-toolbar a:hover { opacity: 1; }
    .lang-toggle { margin-left: auto; display: flex; gap: 8px; }
    .lang-btn { padding: 4px 12px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.3); color: #fff; text-decoration: none; font-size: 12px; font-weight: 600; }
    .lang-btn.active { background: #8b1d41; border-color: #8b1d41; }
    @media (max-width: 640px) {
      .pe-hero { padding: 20px; }
      .pe-hero-title { font-size: 28px; }
      .pe-footer { padding: 24px 20px 32px; }
    }
    ${css}
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />
      <div className="preview-toolbar">
        <Link href="/">← All Newsletters</Link>
        <span style={{ fontWeight: 700 }}>{slug}</span>
        <div className="lang-toggle">
          <Link
            href={`/preview/${folder}/${slug}?lang=en`}
            className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
          >
            EN
          </Link>
          <Link
            href={`/preview/${folder}/${slug}?lang=fr`}
            className={`lang-btn ${lang === 'fr' ? 'active' : ''}`}
          >
            FR
          </Link>
        </div>
      </div>
      <div className="pe-wrapper" dangerouslySetInnerHTML={{ __html: body }} />
    </>
  );
}
