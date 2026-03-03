type Context = Record<string, unknown>;

function resolve(expr: string, contexts: Context[]): unknown {
  if (!expr) return undefined;
  const clean = expr.replace(/\?/g, '').trim();
  const parts = clean.split('.');
  for (let i = contexts.length - 1; i >= 0; i--) {
    const ctx = contexts[i];
    if (parts[0] in ctx) {
      let val: unknown = ctx;
      for (const p of parts) {
        if (val == null) return '';
        val = (val as Record<string, unknown>)[p];
      }
      return val;
    }
  }
  return '';
}

function findClosingTag(html: string, tag: string, startIdx: number) {
  let depth = 1;
  const openRe = new RegExp(`<${tag}[\\s>/]`, 'gi');
  const closeRe = new RegExp(`</${tag}>`, 'gi');
  openRe.lastIndex = startIdx;
  closeRe.lastIndex = startIdx;
  const events: { idx: number; type: 'open' | 'close'; end?: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(html))) events.push({ idx: m.index, type: 'open' });
  while ((m = closeRe.exec(html))) events.push({ idx: m.index, type: 'close', end: m.index + m[0].length });
  events.sort((a, b) => a.idx - b.idx);
  for (const e of events) {
    if (e.type === 'open') depth++;
    else { depth--; if (depth === 0) return e; }
  }
  return null;
}

function processNgFor(html: string, contexts: Context[]): string {
  const ngForRe = /(<(\w[\w-]*)([^>]*)\*ngFor\s*=\s*"let\s+(\w+)\s+of\s+([^"]+)"([^>]*)>)/g;
  let result = html;
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = ngForRe.exec(html))) matches.push(match);
  for (let i = matches.length - 1; i >= 0; i--) {
    match = matches[i];
    const fullOpen = match[1], tag = match[2], loopVar = match[4], collExpr = match[5].trim();
    const openStart = match.index, openEnd = openStart + fullOpen.length;
    const isSelfClosing = fullOpen.endsWith('/>') || ['img', 'br', 'hr', 'input'].includes(tag);
    let blockEnd: number, innerContent: string | null;
    if (isSelfClosing) { blockEnd = openEnd; innerContent = null; }
    else {
      const closing = findClosingTag(result, tag, openEnd);
      if (!closing) continue;
      blockEnd = closing.end!;
      innerContent = result.substring(openEnd, closing.idx);
    }
    const collection = resolve(collExpr, contexts);
    if (!Array.isArray(collection) || !collection.length) {
      result = result.substring(0, openStart) + result.substring(blockEnd);
      continue;
    }
    const cleanOpen = fullOpen.replace(/\s*\*ngFor\s*=\s*"[^"]*"/, '');
    let expanded = '';
    for (const item of collection) {
      const itemCtx = { ...contexts[contexts.length - 1], [loopVar]: item };
      if (isSelfClosing) {
        expanded += resolveBindings(cleanOpen, [...contexts, itemCtx]);
      } else {
        let processed = processNgFor(innerContent!, [...contexts, itemCtx]);
        processed = processNgIf(processed, [...contexts, itemCtx]);
        expanded += cleanOpen + processed + `</${tag}>`;
      }
    }
    result = result.substring(0, openStart) + expanded + result.substring(blockEnd);
  }
  return result;
}

function processNgIf(html: string, contexts: Context[]): string {
  const ngIfRe = /(<(\w[\w-]*)([^>]*)\*ngIf\s*=\s*"([^"]+)"([^>]*)>)/g;
  let result = html;
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = ngIfRe.exec(html))) matches.push(match);
  for (let i = matches.length - 1; i >= 0; i--) {
    match = matches[i];
    const fullOpen = match[1], tag = match[2], condExpr = match[4].trim();
    const openStart = match.index, openEnd = openStart + fullOpen.length;
    const isSelfClosing = fullOpen.endsWith('/>') || ['img', 'br', 'hr', 'input'].includes(tag);
    let blockEnd: number, innerContent: string | null;
    if (isSelfClosing) { blockEnd = openEnd; innerContent = null; }
    else {
      const closing = findClosingTag(result, tag, openEnd);
      if (!closing) continue;
      blockEnd = closing.end!;
      innerContent = result.substring(openEnd, closing.idx);
    }
    let expr: string, alias: string | null;
    const asMatch = condExpr.match(/^(.+)\s+as\s+(\w+)$/);
    if (asMatch) { expr = asMatch[1].trim(); alias = asMatch[2]; }
    else { expr = condExpr; alias = null; }
    const val = resolve(expr, contexts);
    if (!val) { result = result.substring(0, openStart) + result.substring(blockEnd); continue; }
    const newCtx = alias ? [...contexts, { [alias]: val }] : contexts;
    const cleanOpen = fullOpen.replace(/\s*\*ngIf\s*=\s*"[^"]*"/, '');
    if (isSelfClosing) {
      result = result.substring(0, openStart) + resolveBindings(cleanOpen, newCtx) + result.substring(blockEnd);
    } else {
      let processed = processNgFor(innerContent!, newCtx);
      processed = processNgIf(processed, newCtx);
      processed = resolveInterpolations(processed, newCtx);
      processed = resolveBindings(cleanOpen + processed + `</${tag}>`, newCtx);
      result = result.substring(0, openStart) + processed + result.substring(blockEnd);
    }
  }
  return result;
}

function resolveInterpolations(html: string, contexts: Context[]): string {
  return html.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr) => {
    const val = resolve(expr.trim(), contexts);
    return val != null ? String(val) : '';
  });
}

function resolveBindings(html: string, contexts: Context[]): string {
  html = html.replace(/\[innerHTML\]\s*=\s*"([^"]+)"/g, (_, expr) => {
    const val = resolve(expr.trim(), contexts);
    return val != null ? `data-rih="${encodeURIComponent(String(val))}"` : '';
  });
  html = html.replace(/\[src\]\s*=\s*"([^"]+)"/g, (_, expr) => {
    const val = resolve(expr.trim(), contexts);
    return val ? `src="${val}"` : '';
  });
  html = html.replace(/\[href\]\s*=\s*"([^"]+)"/g, (_, expr) => {
    const val = resolve(expr.trim(), contexts);
    return val ? `href="${val}"` : '';
  });
  html = html.replace(/\s*\(click\)\s*=\s*"[^"]*"/g, '');
  html = html.replace(/\s*\[ngClass\]\s*=\s*"[^"]*"/g, '');
  return html;
}

function postProcess(html: string): string {
  html = html.replace(
    /(<\w[\w-]*)([^>]*)\s*data-rih="([^"]*)"([^>]*)(\/?>)([\s\S]*?)(<\/\w[\w-]*>)?/g,
    (_full, tagStart, before, encoded, after, close, _content, closeTag) => {
      const val = decodeURIComponent(encoded);
      if (close === '/>') return `${tagStart}${before}${after}>${val}</${(tagStart as string).slice(1)}>`;
      return `${tagStart}${before}${after}${close}${val}${closeTag || ''}`;
    }
  );
  html = html.replace(/\s*\*ng\w+\s*=\s*"[^"]*"/g, '');
  html = html.replace(/\s*\[\w+\]\s*=\s*"[^"]*"/g, '');
  html = html.replace(/\s*\(\w+\)\s*=\s*"[^"]*"/g, '');
  return html;
}

function renderHeader(edition: string, heroImage: string): string {
  const heroStyle = heroImage
    ? `background: linear-gradient(to top, rgba(139,29,65,0.85), rgba(139,29,65,0.4)), url('${heroImage}') center/cover no-repeat; min-height: 220px; display: flex; align-items: flex-end;`
    : 'background: #8b1d41;';
  return `
  <div class="pe-header">
    <div class="pe-header-container">
      <a href="https://www.cibc.com" target="_blank"><img src="https://braze-images.com/appboy/communication/assets/image_assets/images/67e5524e10463b0067359667/original.png?1743082062" alt="CIBC Logo" class="pe-logo"></a>
    </div>
    <div class="pe-hero" style="${heroStyle}"><div class="pe-hero-content">
      <div class="pe-hero-edition">${edition}</div>
      <div class="pe-hero-title">Summit</div>
      <div class="pe-hero-subtitle">by Premium Edge</div>
    </div></div>
  </div>`;
}

function renderFooter(jsonData: Record<string, unknown>, footerData: Record<string, unknown> | null): string {
  const footer = (jsonData.footer || (footerData as Record<string, unknown>)?.text || {}) as Record<string, unknown>;
  let html = '<div class="pe-footer">';
  if (footer.ratingQuestion) {
    html += `<div class="pe-rating"><p class="pe-rating-q">${footer.ratingQuestion}</p>
    <div class="pe-rating-scale">${[1,2,3,4,5].map(n=>`<span class="pe-rating-circle">${n}</span>`).join('')}</div>
    <div class="pe-rating-labels"><span>${footer.ratingLabelLow||''}</span><span>${footer.ratingLabelHigh||''}</span></div></div>`;
  }
  if (footer.sourceNote) html += `<div class="pe-source">${footer.sourceNote}</div>`;
  const notes = Array.isArray(footer.offerNotes)
    ? footer.offerNotes
    : [footer.offerNote1, footer.offerNote2, footer.freeTradesNote, footer.cashBackNote, footer.accountTypesNote, footer.fullDetailsNote].filter(Boolean);
  if (notes.length) { html += '<div class="pe-offer-notes">'; for (const n of notes) html += `<p>${n}</p>`; html += '</div>'; }
  html += `<div class="pe-social">
    <a href="https://www.instagram.com/cibc/" target="_blank"><img src="https://braze-images.com/appboy/communication/assets/image_assets/images/634d9801111824241b135cae/original.png?1666029569" alt="Instagram"></a>
    <a href="https://www.facebook.com/CIBC/" target="_blank"><img src="https://braze-images.com/appboy/communication/assets/image_assets/images/634d98010ef4e342e5846fac/original.png?1666029569" alt="Facebook"></a>
    <a href="https://www.youtube.com/user/CIBCVideos" target="_blank"><img src="https://braze-images.com/appboy/communication/assets/image_assets/images/634d9801bb79b12c7f5b2319/original.png?1666029569" alt="YouTube"></a>
  </div>
  <div class="pe-legal">
    <p>The CIBC logo and &ldquo;Investor&rsquo;s Edge&rdquo; are trademarks of CIBC, used under license.</p>
    <p>This content is for informational purposes only. To reach us, visit <a href="https://www.investorsedge.cibc.com/en/contact-us.html" target="_blank">investorsedge.cibc.com/contact-us</a></p>
    <p>Your privacy is our priority. View our <a href="https://www.cibc.com/ca/legal/privacy-policy.html" target="_blank">privacy policy</a>.</p>
    <p>CIBC Investor&rsquo;s Edge, 161 Bay Street, 4th Floor, Toronto, ON M5J 2S8</p>
  </div></div>`;
  return html;
}

export interface FileMap {
  [relativePath: string]: string;
}

export interface DiscoveredNewsletter {
  id: string;
  slug: string;
  folder: string;
  hasEn: boolean;
  hasFr: boolean;
  templatePath: string;
  scssPath: string;
  enJsonPath: string;
  frJsonPath: string | null;
  footerPattern: string;
}

function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/');
}

export function discoverFromFiles(files: FileMap): DiscoveredNewsletter[] {
  const results: DiscoveredNewsletter[] = [];
  const paths = Object.keys(files);

  const enJsons = paths.filter(
    (p) => /pe-newsletter-\w+-en\.json$/.test(p) && !p.includes('header') && !p.includes('footer')
  );

  for (const jsonPath of enJsons) {
    const lastSlash = jsonPath.lastIndexOf('/');
    const dir = lastSlash >= 0 ? jsonPath.substring(0, lastSlash) : '';
    const filename = lastSlash >= 0 ? jsonPath.substring(lastSlash + 1) : jsonPath;
    const slug = filename.replace('-en.json', '');

    const templatePath = joinPath(dir, slug, `${slug}.component.html`);
    const scssPath = joinPath(dir, slug, `${slug}.component.scss`);

    if (!(templatePath in files)) continue;

    const frJsonPath = jsonPath.replace('-en.json', '-fr.json');
    const hasFr = frJsonPath in files;

    const folderLabel = dir || 'Root';

    results.push({
      id: `${dir}/${slug}`,
      slug,
      folder: folderLabel,
      hasEn: true,
      hasFr,
      templatePath,
      scssPath,
      enJsonPath: jsonPath,
      frJsonPath: hasFr ? frJsonPath : null,
      footerPattern: dir,
    });
  }

  return results;
}

function safeParseJson(content: string, filePath: string): Record<string, unknown> {
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`Invalid JSON in "${filePath}": ${(e as Error).message}\nFirst 200 chars: ${content.slice(0, 200)}`);
  }
}

export function renderNewsletter(files: FileMap, newsletter: DiscoveredNewsletter, lang: string): string | null {
  const jsonPath = lang === 'fr' && newsletter.frJsonPath ? newsletter.frJsonPath : newsletter.enJsonPath;
  if (lang === 'fr' && !newsletter.frJsonPath) return null;
  if (!(jsonPath in files)) return null;

  const jsonData = safeParseJson(files[jsonPath], jsonPath);
  let template = files[newsletter.templatePath];

  const footerPath = Object.keys(files).find(
    (p) =>
      p.endsWith(`pe-newsletter-footer-${lang}.json`) &&
      (newsletter.footerPattern === '' || p.startsWith(newsletter.footerPattern))
  );
  const footerData = footerPath ? safeParseJson(files[footerPath], footerPath) : null;

  const textData = (jsonData as Record<string, unknown>).text as Record<string, unknown> | undefined;
  const edition = textData?.edition as string || '';
  const heroImage = textData?.heroImage as string || '';

  template = template.replace(/<app-pe-newsletter-header[^>]*>[\s\S]*?<\/app-pe-newsletter-header>/g,
    () => renderHeader(edition, heroImage));
  template = template.replace(/<app-pe-newsletter-footer[^>]*>[\s\S]*?<\/app-pe-newsletter-footer>/g,
    () => renderFooter(jsonData, footerData));

  const contexts: Context[] = [{ newsletterContent: jsonData }];
  let html = processNgFor(template, contexts);
  html = processNgIf(html, contexts);
  html = resolveInterpolations(html, contexts);
  html = resolveBindings(html, contexts);
  html = postProcess(html);
  html = resolveImagePaths(html, files);
  return html;
}

function findImageDataUrl(srcPath: string, files: FileMap): string | null {
  if (srcPath.startsWith('data:') || srcPath.startsWith('http')) return null;
  const match = Object.keys(files).find((p) => {
    if (!files[p].startsWith('data:')) return false;
    return p === srcPath || p.endsWith('/' + srcPath) || p.endsWith(srcPath.replace(/^\.\//, ''));
  });
  return match ? files[match] : null;
}

function resolveImagePaths(html: string, files: FileMap): string {
  // Resolve src="..." attributes
  html = html.replace(/src="([^"]+)"/g, (full, srcPath: string) => {
    const dataUrl = findImageDataUrl(srcPath, files);
    return dataUrl ? `src="${dataUrl}"` : full;
  });
  // Resolve url('...') in inline styles
  html = html.replace(/url\('([^']+)'\)/g, (full, srcPath: string) => {
    const dataUrl = findImageDataUrl(srcPath, files);
    return dataUrl ? `url('${dataUrl}')` : full;
  });
  return html;
}
