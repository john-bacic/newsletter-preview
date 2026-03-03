'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  FileMap,
  DiscoveredNewsletter,
  discoverFromFiles,
  renderNewsletter,
} from '@/lib/template-engine';

const GIT_SHA = process.env.NEXT_PUBLIC_GIT_SHA || 'dev';
const GIT_MSG = process.env.NEXT_PUBLIC_GIT_COMMIT_MSG || '';

function ErrorPanel({ error, debug }: { error: string | null; debug: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!error) return null;
  return (
    <div style={{
      margin: '20px auto', padding: '16px 24px', background: '#fff3f3',
      border: '1px solid #ffcccc', borderRadius: 8, maxWidth: 700, width: '100%',
    }}>
      <div style={{ color: '#c0392b', fontSize: 14, fontWeight: 600, marginBottom: debug ? 8 : 0 }}>
        {error}
      </div>
      {debug && (
        <>
          <button onClick={() => setExpanded(!expanded)} style={{
            background: 'none', border: 'none', color: '#999', fontSize: 12,
            cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline',
          }}>{expanded ? 'Hide' : 'Show'} details</button>
          {expanded && (
            <pre style={{
              marginTop: 8, padding: 12, background: '#fff', border: '1px solid #eee',
              borderRadius: 6, fontSize: 12, lineHeight: 1.5, color: '#555',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflow: 'auto', maxHeight: 300,
            }}>{debug}</pre>
          )}
        </>
      )}
    </div>
  );
}

function VersionBadge({ light }: { light?: boolean }) {
  const color = light ? 'rgba(255,255,255,0.35)' : '#bbb';
  return (
    <div style={{
      position: 'fixed', bottom: 8, right: 12, fontSize: 11,
      color, fontFamily: 'monospace', zIndex: 200, pointerEvents: 'none',
      textAlign: 'right', lineHeight: 1.4,
    }}>
      <span>{GIT_SHA}</span>
      {GIT_MSG && <span style={{ marginLeft: 6, fontFamily: "'Open Sans',sans-serif", fontStyle: 'italic' }}>{GIT_MSG}</span>}
    </div>
  );
}

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

async function readAllEntries(dirEntry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = dirEntry.createReader();
  const all: FileSystemEntry[] = [];
  let batch: FileSystemEntry[];
  do {
    batch = await new Promise<FileSystemEntry[]>((res, rej) =>
      reader.readEntries(res as (entries: FileSystemEntry[]) => void, rej)
    );
    all.push(...batch);
  } while (batch.length > 0);
  return all;
}

async function readDirectory(entry: FileSystemDirectoryEntry): Promise<FileMap> {
  const files: FileMap = {};
  async function walk(dirEntry: FileSystemDirectoryEntry, prefix: string) {
    const entries = await readAllEntries(dirEntry);
    for (const e of entries) {
      const fullPath = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isFile) {
        if (/\.(json|html|scss)$/i.test(e.name)) {
          const text = await new Promise<string>((res, rej) => {
            (e as FileSystemFileEntry).file((file) => {
              const r = new FileReader();
              r.onload = () => res(r.result as string);
              r.onerror = rej;
              r.readAsText(file);
            }, rej);
          });
          files[fullPath] = text;
        }
      } else if (e.isDirectory) {
        await walk(e as FileSystemDirectoryEntry, fullPath);
      }
    }
  }
  await walk(entry, '');
  return files;
}

export default function Home() {
  const [files, setFiles] = useState<FileMap | null>(null);
  const [newsletters, setNewsletters] = useState<DiscoveredNewsletter[]>([]);
  const [preview, setPreview] = useState<{ html: string; css: string; nl: DiscoveredNewsletter; lang: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const processFiles = useCallback(async (allFiles: FileMap) => {
    const paths = Object.keys(allFiles);
    const fileCount = paths.length;

    const debug = [
      `Files read: ${fileCount}`,
      `JSON files: ${paths.filter(p => p.endsWith('.json')).join(', ') || 'none'}`,
      `HTML files: ${paths.filter(p => p.endsWith('.html')).join(', ') || 'none'}`,
      `SCSS files: ${paths.filter(p => p.endsWith('.scss')).join(', ') || 'none'}`,
    ].join('\n');

    if (fileCount === 0) {
      setError('No files found. Make sure you selected a folder (not individual files).');
      setDebugInfo(debug);
      setLoading(false);
      return;
    }
    setFiles(allFiles);
    const found = discoverFromFiles(allFiles);
    if (found.length === 0) {
      setError(
        `Read ${fileCount} files but found no newsletters. Expected pe-newsletter-*-en.json + a matching component subfolder.`
      );
      setDebugInfo(debug);
      setFiles(null);
    } else {
      setDebugInfo(null);
    }
    setNewsletters(found);
    setLoading(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    setLoading(true);
    setPreview(null);
    setError(null);

    try {
      const items = e.dataTransfer.items;
      let allFiles: FileMap = {};
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          const dirFiles = await readDirectory(entry as FileSystemDirectoryEntry);
          allFiles = { ...allFiles, ...dirFiles };
        }
      }
      await processFiles(allFiles);
    } catch (err) {
      setError(`Error reading files: ${(err as Error).message}`);
      setLoading(false);
    }
  }, [processFiles]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setLoading(true);
    setPreview(null);
    setError(null);

    try {
      const allFiles: FileMap = {};
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const relativePath = file.webkitRelativePath || file.name;
        const parts = relativePath.split('/');
        const pathWithoutRoot = parts.slice(1).join('/');
        if (/\.(json|html|scss)$/i.test(file.name)) {
          allFiles[pathWithoutRoot] = await file.text();
        }
      }
      await processFiles(allFiles);
    } catch (err) {
      setError(`Error reading files: ${(err as Error).message}`);
      setLoading(false);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [processFiles]);

  const openPreview = useCallback(async (nl: DiscoveredNewsletter, lang: string) => {
    if (!files) return;
    setLoading(true);
    setError(null);
    setDebugInfo(null);

    try {
      const body = renderNewsletter(files, nl, lang);
      if (!body) {
        const jsonPath = lang === 'fr' ? nl.frJsonPath : nl.enJsonPath;
        setError(`Could not render ${nl.slug} in ${lang.toUpperCase()}`);
        setDebugInfo([
          `Slug: ${nl.slug}`,
          `Language: ${lang}`,
          `Template: ${nl.templatePath} (${nl.templatePath in files ? 'found' : 'MISSING'})`,
          `JSON: ${jsonPath} (${jsonPath && jsonPath in files ? 'found' : 'MISSING'})`,
          `SCSS: ${nl.scssPath} (${nl.scssPath in files ? 'found' : 'MISSING'})`,
        ].join('\n'));
        setLoading(false);
        return;
      }

      let css = '';
      let scssError = '';
      if (nl.scssPath in files) {
        try {
          const res = await fetch('/api/compile-scss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scss: files[nl.scssPath] }),
          });
          if (!res.ok) {
            scssError = `SCSS API returned ${res.status}`;
          } else {
            const data = await res.json();
            css = data.css || '';
          }
        } catch (e) {
          scssError = `SCSS compilation failed: ${(e as Error).message}`;
        }
      }

      setPreview({ html: body, css, nl, lang });
      if (scssError) setDebugInfo(scssError);
    } catch (err) {
      const jsonPath = lang === 'fr' ? nl.frJsonPath : nl.enJsonPath;
      setError((err as Error).message);
      setDebugInfo([
        `Slug: ${nl.slug}`,
        `Language: ${lang}`,
        `Template: ${nl.templatePath}`,
        `JSON: ${jsonPath}`,
        `SCSS: ${nl.scssPath}`,
        `All loaded files: ${Object.keys(files).join(', ')}`,
      ].join('\n'));
    }
    setLoading(false);
  }, [files]);

  const [iframeReady, setIframeReady] = useState(false);

  useEffect(() => {
    if (!iframeReady || !iframeRef.current || !preview) return;
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
  }, [preview, iframeReady]);

  // ─── PREVIEW VIEW ───
  if (preview) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <VersionBadge light />
        <div style={{
          background: '#1a1a2e', color: '#fff', padding: '10px 20px',
          display: 'flex', alignItems: 'center', gap: 16, fontSize: 14, flexShrink: 0,
        }}>
          <button onClick={() => setPreview(null)} style={{
            background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
            opacity: 0.8, fontWeight: 500, fontSize: 13, fontFamily: 'inherit',
          }}>← Back</button>
          <span style={{ fontWeight: 700 }}>{preview.nl.slug}</span>
          <span style={{ fontSize: 11, opacity: 0.5 }}>{preview.nl.folder}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {preview.nl.hasEn && (
              <button onClick={() => openPreview(preview.nl, 'en')} style={{
                padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                background: preview.lang === 'en' ? '#8b1d41' : 'transparent',
                color: '#fff', border: `1px solid ${preview.lang === 'en' ? '#8b1d41' : 'rgba(255,255,255,0.3)'}`,
              }}>EN</button>
            )}
            {preview.nl.hasFr && (
              <button onClick={() => openPreview(preview.nl, 'fr')} style={{
                padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                background: preview.lang === 'fr' ? '#8b1d41' : 'transparent',
                color: '#fff', border: `1px solid ${preview.lang === 'fr' ? '#8b1d41' : 'rgba(255,255,255,0.3)'}`,
              }}>FR</button>
            )}
          </div>
        </div>
        <iframe
          ref={iframeRef}
          onLoad={() => setIframeReady(true)}
          style={{ flex: 1, border: 'none', width: '100%' }}
          srcDoc="<html><body></body></html>"
        />
      </div>
    );
  }

  // ─── NEWSLETTER LIST (DASHBOARD) ───
  if (newsletters.length > 0) {
    const grouped: Record<string, DiscoveredNewsletter[]> = {};
    for (const n of newsletters) {
      if (!grouped[n.folder]) grouped[n.folder] = [];
      grouped[n.folder].push(n);
    }

    return (
      <div style={{ minHeight: '100vh', background: '#f2f3f2' }}>
        <VersionBadge />
        <header style={{ background: '#1a1a2e', color: '#fff', padding: '32px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Newsletter Preview</h1>
              <p style={{ fontSize: 14, opacity: 0.7, margin: 0 }}>
                Found {newsletters.length} newsletter{newsletters.length > 1 ? 's' : ''}. Select one to preview.
              </p>
            </div>
            <button onClick={() => { setFiles(null); setNewsletters([]); setError(null); }} style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', padding: '8px 16px', borderRadius: 4, cursor: 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
            }}>Drop another folder</button>
          </div>
        </header>

        {Object.entries(grouped).map(([folder, items]) => (
          <div key={folder} style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px' }}>
            <h2 style={{ fontSize: 13, color: '#606366', letterSpacing: 1, textTransform: 'uppercase', padding: '24px 0 12px' }}>
              {folder}
            </h2>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16,
            }}>
              {items.map((n) => {
                const name = n.slug.replace('pe-newsletter-', '').replace(/(\d{2})$/, ' 20$1')
                  .replace(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, m => m.charAt(0).toUpperCase() + m.slice(1));
                return (
                  <div key={n.id} style={{
                    background: '#fff', borderRadius: 12, padding: 24,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
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
          </div>
        ))}

        <ErrorPanel error={error} debug={debugInfo} />

        {loading && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: '#fff', padding: '24px 32px', borderRadius: 12, fontSize: 16, fontWeight: 600 }}>Rendering...</div>
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
        minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative',
        alignItems: 'center', justifyContent: 'center',
        background: dragging ? '#e8e0f0' : '#f2f3f2', transition: 'background 0.2s',
      }}
    >
      <div style={{
        border: `3px dashed ${dragging ? '#8b1d41' : '#ccc'}`,
        borderRadius: 24, padding: '80px 60px', textAlign: 'center',
        maxWidth: 600, transition: 'border-color 0.2s',
      }}>
        <input
          ref={fileInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is non-standard but works in all major browsers
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#383b3e', marginBottom: 8 }}>
          Newsletter Preview
        </h1>
        <p style={{ fontSize: 16, color: '#606366', lineHeight: 1.6 }}>
          Drag &amp; drop a newsletter folder here, or browse to select one.
        </p>
        <button onClick={handleBrowse} style={{
          marginTop: 20, padding: '12px 28px', borderRadius: 6, fontSize: 15, fontWeight: 600,
          background: '#8b1d41', color: '#fff', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', transition: 'background 0.15s',
        }}>
          Browse folder…
        </button>
        <p style={{ fontSize: 13, color: '#999', marginTop: 20 }}>
          Single newsletter folder or a parent containing multiple newsletters.
          <br />
          Expects <code style={{ background: '#e8e8e8', padding: '2px 6px', borderRadius: 4 }}>pe-newsletter-*-en.json</code> + component subfolder with <code style={{ background: '#e8e8e8', padding: '2px 6px', borderRadius: 4 }}>.component.html</code> / <code style={{ background: '#e8e8e8', padding: '2px 6px', borderRadius: 4 }}>.component.scss</code>
        </p>
        <p style={{ fontSize: 12, color: '#bbb', marginTop: 20 }}>
          Files stay in your browser. Only SCSS is sent to the server for compilation.
        </p>
      </div>

      {loading && (
        <div style={{ marginTop: 24, fontSize: 16, fontWeight: 600, color: '#8b1d41' }}>Reading files...</div>
      )}

      <ErrorPanel error={error} debug={debugInfo} />

      <VersionBadge />
    </div>
  );
}
