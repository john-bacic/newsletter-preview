'use client';

import { useState, useCallback, useRef } from 'react';
import {
  FileMap,
  DiscoveredNewsletter,
  discoverFromFiles,
  renderNewsletter,
} from '@/lib/template-engine';

const SHELL_CSS = `
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Open Sans',Arial,sans-serif; background:#e8e8e8; color:#383b3e; }
a { color:#8b1d41; text-decoration:none; cursor:pointer; }
a:hover { text-decoration:underline; }
sup { vertical-align:super; font-size:.75em; line-height:0; }
.pe-wrapper { max-width:800px; margin:0 auto; background:#fff; }
.pe-header-container { max-width:800px; margin:0 auto; }
.pe-logo { display:block; width:100%; max-width:800px; height:auto; }
.pe-hero { background:#8b1d41; padding:40px; }
.pe-hero-content { color:#fff; }
.pe-hero-edition { font-size:12px; letter-spacing:3px; font-weight:400; margin-bottom:4px; }
.pe-hero-title { font-size:42px; font-weight:700; margin-bottom:2px; }
.pe-hero-subtitle { font-size:14px; font-weight:400; }
.pe-footer { background:#f2f3f2; padding:30px 40px 40px; }
.pe-rating { margin-bottom:24px; }
.pe-rating-q { font-size:14px; font-weight:600; margin-bottom:8px; }
.pe-rating-scale { display:flex; gap:8px; margin-bottom:4px; }
.pe-rating-circle { width:32px; height:32px; border-radius:50%; border:2px solid #8b1d41; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; color:#8b1d41; }
.pe-rating-labels { display:flex; justify-content:space-between; font-size:11px; color:#606366; max-width:200px; }
.pe-source { font-size:11px; line-height:1.4; color:#606366; margin-bottom:16px; }
.pe-source a { font-size:11px; color:#606366; }
.pe-offer-notes p { font-size:11px; line-height:1.3; color:#606366; margin-bottom:10px; }
.pe-offer-notes a { font-size:11px; color:#606366; }
.pe-social { display:flex; justify-content:flex-end; gap:8px; margin:20px 0; }
.pe-social img { height:22px; width:auto; }
.pe-legal { font-size:11px; line-height:1.3; color:#606366; }
.pe-legal p { margin-bottom:12px; }
.pe-legal a { color:#606366; font-size:11px; }
@media(max-width:640px){.pe-hero{padding:20px}.pe-hero-title{font-size:28px}.pe-footer{padding:24px 20px 32px}}
`;

async function readDirectory(entry: FileSystemDirectoryEntry): Promise<FileMap> {
  const files: FileMap = {};
  async function walk(dirEntry: FileSystemDirectoryEntry, prefix: string) {
    const reader = dirEntry.createReader();
    let entries: FileSystemEntry[] = [];
    let batch: FileSystemEntry[];
    do {
      batch = await new Promise((res, rej) => reader.readEntries(res as (entries: FileSystemEntry[]) => void, rej));
      entries = entries.concat(batch);
    } while (batch.length > 0);

    for (const entry of entries) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        if (/\.(json|html|scss|ts)$/i.test(entry.name)) {
          const text = await new Promise<string>((res, rej) => {
            fileEntry.file((file) => {
              const reader = new FileReader();
              reader.onload = () => res(reader.result as string);
              reader.onerror = rej;
              reader.readAsText(file);
            }, rej);
          });
          files[fullPath] = text;
        }
      } else if (entry.isDirectory) {
        await walk(entry as FileSystemDirectoryEntry, fullPath);
      }
    }
  }
  await walk(entry, '');
  return files;
}

export default function Home() {
  const [files, setFiles] = useState<FileMap | null>(null);
  const [newsletters, setNewsletters] = useState<DiscoveredNewsletter[]>([]);
  const [preview, setPreview] = useState<{ html: string; css: string; slug: string; lang: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    setLoading(true);
    setPreview(null);

    const items = e.dataTransfer.items;
    let allFiles: FileMap = {};

    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        const dirFiles = await readDirectory(entry as FileSystemDirectoryEntry);
        allFiles = { ...allFiles, ...dirFiles };
      }
    }

    setFiles(allFiles);
    const found = discoverFromFiles(allFiles);
    setNewsletters(found);
    setLoading(false);
  }, []);

  const openPreview = useCallback(async (nl: DiscoveredNewsletter, lang: string) => {
    if (!files) return;
    setLoading(true);
    const body = renderNewsletter(files, nl, lang);
    if (!body) { setLoading(false); return; }

    let css = '';
    if (nl.scssPath in files) {
      try {
        const res = await fetch('/api/compile-scss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scss: files[nl.scssPath] }),
        });
        const data = await res.json();
        css = data.css || '';
      } catch { /* fallback: no component CSS */ }
    }

    setPreview({ html: body, css, slug: nl.slug, lang });
    setLoading(false);
  }, [files]);

  const reset = useCallback(() => {
    setPreview(null);
  }, []);

  const fullReset = useCallback(() => {
    setFiles(null);
    setNewsletters([]);
    setPreview(null);
  }, []);

  // Write preview into iframe
  const iframeLoaded = useCallback(() => {
    if (!iframeRef.current || !preview) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${SHELL_CSS}\n${preview.css}</style>
</head><body><div class="pe-wrapper">${preview.html}</div></body></html>`);
    doc.close();
  }, [preview]);

  // ─── PREVIEW VIEW ───
  if (preview) {
    const nl = newsletters.find(n => n.slug === preview.slug);
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          background: '#1a1a2e', color: '#fff', padding: '10px 20px',
          display: 'flex', alignItems: 'center', gap: 16, fontSize: 14, flexShrink: 0,
        }}>
          <button onClick={reset} style={{
            background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
            opacity: 0.8, fontWeight: 500, fontSize: 13, fontFamily: 'inherit',
          }}>← Back</button>
          <span style={{ fontWeight: 700 }}>{preview.slug}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {nl?.hasEn && (
              <button onClick={() => openPreview(nl, 'en')} style={{
                padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                background: preview.lang === 'en' ? '#8b1d41' : 'transparent',
                color: '#fff', border: '1px solid ' + (preview.lang === 'en' ? '#8b1d41' : 'rgba(255,255,255,0.3)'),
              }}>EN</button>
            )}
            {nl?.hasFr && (
              <button onClick={() => openPreview(nl, 'fr')} style={{
                padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                background: preview.lang === 'fr' ? '#8b1d41' : 'transparent',
                color: '#fff', border: '1px solid ' + (preview.lang === 'fr' ? '#8b1d41' : 'rgba(255,255,255,0.3)'),
              }}>FR</button>
            )}
          </div>
        </div>
        <iframe
          ref={iframeRef}
          onLoad={iframeLoaded}
          style={{ flex: 1, border: 'none', width: '100%' }}
          srcDoc="<html><body></body></html>"
        />
      </div>
    );
  }

  // ─── NEWSLETTER LIST ───
  if (newsletters.length > 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#f2f3f2' }}>
        <header style={{ background: '#1a1a2e', color: '#fff', padding: '32px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Newsletter Preview</h1>
              <p style={{ fontSize: 14, opacity: 0.7, margin: 0 }}>
                Found {newsletters.length} newsletter{newsletters.length > 1 ? 's' : ''}. Select one to preview.
              </p>
            </div>
            <button onClick={fullReset} style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', padding: '8px 16px', borderRadius: 4, cursor: 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
            }}>Drop another folder</button>
          </div>
        </header>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20, padding: '32px 40px', maxWidth: 1200, margin: '0 auto',
        }}>
          {newsletters.map((n) => {
            const name = n.slug.replace('pe-newsletter-', '').replace(/(\d{2})$/, ' 20$1')
              .replace(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, m => m.charAt(0).toUpperCase() + m.slice(1));
            return (
              <div key={n.slug} style={{
                background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#383b3e', marginBottom: 16, textTransform: 'capitalize' }}>
                  {name}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  {n.hasEn && (
                    <button onClick={() => openPreview(n, 'en')} style={{
                      padding: '8px 20px', borderRadius: 4, fontSize: 14, fontWeight: 600,
                      background: '#8b1d41', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    }}>English</button>
                  )}
                  {n.hasFr && (
                    <button onClick={() => openPreview(n, 'fr')} style={{
                      padding: '8px 20px', borderRadius: 4, fontSize: 14, fontWeight: 600,
                      background: '#f2f3f2', color: '#383b3e', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    }}>French</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {loading && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: '#fff', padding: '24px 32px', borderRadius: 12, fontSize: 16, fontWeight: 600 }}>
              Rendering preview...
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── DROP ZONE ───
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: dragging ? '#e8e0f0' : '#f2f3f2',
        transition: 'background 0.2s',
      }}
    >
      <div style={{
        border: `3px dashed ${dragging ? '#8b1d41' : '#ccc'}`,
        borderRadius: 24, padding: '80px 60px', textAlign: 'center',
        maxWidth: 600, transition: 'border-color 0.2s',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#383b3e', marginBottom: 8 }}>
          Newsletter Preview
        </h1>
        <p style={{ fontSize: 16, color: '#606366', lineHeight: 1.6 }}>
          Drag &amp; drop a newsletter folder here to preview it.
        </p>
        <p style={{ fontSize: 13, color: '#999', marginTop: 16 }}>
          The folder should contain <code style={{ background: '#e8e8e8', padding: '2px 6px', borderRadius: 4 }}>pe-newsletter-*-en.json</code> and
          a component subfolder with <code style={{ background: '#e8e8e8', padding: '2px 6px', borderRadius: 4 }}>.component.html</code> / <code style={{ background: '#e8e8e8', padding: '2px 6px', borderRadius: 4 }}>.component.scss</code>
        </p>
        <p style={{ fontSize: 12, color: '#bbb', marginTop: 24 }}>
          Files never leave your browser — only SCSS is sent to the server for compilation.
        </p>
      </div>
      {loading && (
        <div style={{ marginTop: 24, fontSize: 16, fontWeight: 600, color: '#8b1d41' }}>
          Reading files...
        </div>
      )}
    </div>
  );
}
