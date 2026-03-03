import fs from 'fs';
import path from 'path';
import * as sass from 'sass';

const NEWSLETTERS_DIR = path.join(process.cwd(), 'newsletters');

const GLOBAL_VAR_SHIM = `
$colors: (
  '01': #ffffff, '02': #383b3e, '03': #606366, '07': #f2f3f2,
  '10': #6e1634, '11': #8b1d41, '90': #5a1029, '112': #f5f0f2,
);
@function color($key) { @return map-get($colors, $key); }
$mobile: "(max-width: 640px)";
@mixin fontMixin($size, $family: 'Open Sans', $weight: normal) {
  font-size: #{$size}px;
  font-family: 'Open Sans', Arial, sans-serif;
}
`;

export interface Newsletter {
  folder: string;
  slug: string;
  absDir: string;
  componentDir: string;
}

export function discoverNewsletters(): Newsletter[] {
  const results: Newsletter[] = [];
  if (!fs.existsSync(NEWSLETTERS_DIR)) return results;

  for (const entry of fs.readdirSync(NEWSLETTERS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const absDir = path.join(NEWSLETTERS_DIR, entry.name);
    const files = fs.readdirSync(absDir);
    const enJsons = files.filter(
      (f) => /^pe-newsletter-\w+-en\.json$/.test(f) && !f.includes('header') && !f.includes('footer')
    );
    for (const jsonFile of enJsons) {
      const slug = jsonFile.replace('-en.json', '');
      const componentDir = path.join(absDir, slug);
      if (fs.existsSync(componentDir)) {
        results.push({ folder: entry.name, slug, absDir, componentDir });
      }
    }
  }
  return results;
}

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
    else {
      depth--;
      if (depth === 0) return e;
    }
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
    const fullOpen = match[1];
    const tag = match[2];
    const loopVar = match[4];
    const collExpr = match[5].trim();
    const openStart = match.index;
    const openEnd = openStart + fullOpen.length;
    const isSelfClosing = fullOpen.endsWith('/>') || ['img', 'br', 'hr', 'input'].includes(tag);
    let blockEnd: number, innerContent: string | null;
    if (isSelfClosing) {
      blockEnd = openEnd;
      innerContent = null;
    } else {
      const closing = findClosingTag(result, tag, openEnd);
      if (!closing) continue;
      blockEnd = closing.end!;
      innerContent = result.substring(openEnd, closing.idx);
    }
    const collection = resolve(collExpr, contexts);
    if (!Array.isArray(collection) || collection.length === 0) {
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
    const fullOpen = match[1];
    const tag = match[2];
    const condExpr = match[4].trim();
    const openStart = match.index;
    const openEnd = openStart + fullOpen.length;
    const isSelfClosing = fullOpen.endsWith('/>') || ['img', 'br', 'hr', 'input'].includes(tag);
    let blockEnd: number, innerContent: string | null;
    if (isSelfClosing) {
      blockEnd = openEnd;
      innerContent = null;
    } else {
      const closing = findClosingTag(result, tag, openEnd);
      if (!closing) continue;
      blockEnd = closing.end!;
      innerContent = result.substring(openEnd, closing.idx);
    }
    let expr: string, alias: string | null;
    const asMatch = condExpr.match(/^(.+)\s+as\s+(\w+)$/);
    if (asMatch) {
      expr = asMatch[1].trim();
      alias = asMatch[2];
    } else {
      expr = condExpr;
      alias = null;
    }
    const val = resolve(expr, contexts);
    if (!val) {
      result = result.substring(0, openStart) + result.substring(blockEnd);
      continue;
    }
    const newCtx = alias ? [...contexts, { [alias]: val }] : contexts;
    const cleanOpen = fullOpen.replace(/\s*\*ngIf\s*=\s*"[^"]*"/, '');
    if (isSelfClosing) {
      const processed = resolveBindings(cleanOpen, newCtx);
      result = result.substring(0, openStart) + processed + result.substring(blockEnd);
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
    return val != null ? `data-resolved-innerhtml="${encodeURIComponent(String(val))}"` : '';
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
    /(<\w[\w-]*)([^>]*)\s*data-resolved-innerhtml="([^"]*)"([^>]*)(\/?>)([\s\S]*?)(<\/\w[\w-]*>)?/g,
    (full, tagStart, before, encoded, after, close, content, closeTag) => {
      const val = decodeURIComponent(encoded);
      if (close === '/>')
        return `${tagStart}${before}${after}>${val}</${(tagStart as string).slice(1)}>`;
      return `${tagStart}${before}${after}${close}${val}${closeTag || ''}`;
    }
  );
  html = html.replace(/\s*\*ng\w+\s*=\s*"[^"]*"/g, '');
  html = html.replace(/\s*\[\w+\]\s*=\s*"[^"]*"/g, '');
  html = html.replace(/\s*\(\w+\)\s*=\s*"[^"]*"/g, '');
  return html;
}

function renderHeader(edition: string): string {
  return `
  <div class="pe-header">
    <div class="pe-header-container">
      <a href="https://www.cibc.com" target="_blank"><img src="https://braze-images.com/appboy/communication/assets/image_assets/images/67e5524e10463b0067359667/original.png?1743082062" alt="CIBC Logo" class="pe-logo"></a>
    </div>
    <div class="pe-hero">
      <div class="pe-hero-content">
        <div class="pe-hero-edition">${edition}</div>
        <div class="pe-hero-title">Summit</div>
        <div class="pe-hero-subtitle">by Premium Edge</div>
      </div>
    </div>
  </div>`;
}

function renderFooter(jsonData: Record<string, unknown>, footerData: Record<string, unknown> | null): string {
  const footer = (jsonData.footer || (footerData as Record<string, unknown>)?.text || {}) as Record<string, unknown>;
  let html = '<div class="pe-footer">';

  if (footer.ratingQuestion) {
    html += `
    <div class="pe-rating">
      <p class="pe-rating-q">${footer.ratingQuestion}</p>
      <div class="pe-rating-scale">${[1, 2, 3, 4, 5].map((n) => `<span class="pe-rating-circle">${n}</span>`).join('')}</div>
      <div class="pe-rating-labels"><span>${footer.ratingLabelLow || ''}</span><span>${footer.ratingLabelHigh || ''}</span></div>
    </div>`;
  }
  if (footer.sourceNote) html += `<div class="pe-source">${footer.sourceNote}</div>`;
  if (Array.isArray(footer.offerNotes)) {
    html += '<div class="pe-offer-notes">';
    for (const note of footer.offerNotes) html += `<p>${note}</p>`;
    html += '</div>';
  } else {
    const notes = [footer.offerNote1, footer.offerNote2, footer.freeTradesNote, footer.cashBackNote, footer.accountTypesNote, footer.fullDetailsNote].filter(Boolean);
    if (notes.length) {
      html += '<div class="pe-offer-notes">';
      for (const n of notes) html += `<p>${n}</p>`;
      html += '</div>';
    }
  }
  html += `
  <div class="pe-social">
    <a href="https://www.instagram.com/cibc/" target="_blank"><img src="https://braze-images.com/appboy/communication/assets/image_assets/images/634d9801111824241b135cae/original.png?1666029569" alt="Instagram"></a>
    <a href="https://www.facebook.com/CIBC/" target="_blank"><img src="https://braze-images.com/appboy/communication/assets/image_assets/images/634d98010ef4e342e5846fac/original.png?1666029569" alt="Facebook"></a>
    <a href="https://www.youtube.com/user/CIBCVideos" target="_blank"><img src="https://braze-images.com/appboy/communication/assets/image_assets/images/634d9801bb79b12c7f5b2319/original.png?1666029569" alt="YouTube"></a>
  </div>
  <div class="pe-legal">
    <p>The CIBC logo and "Investor's Edge" are trademarks of CIBC, used under license.</p>
    <p>This content is for informational purposes only. To reach us, visit <a href="https://www.investorsedge.cibc.com/en/contact-us.html" target="_blank">investorsedge.cibc.com/contact-us</a></p>
    <p>Your privacy is our priority. View our <a href="https://www.cibc.com/ca/legal/privacy-policy.html" target="_blank">privacy policy</a>.</p>
    <p>CIBC Investor's Edge, 161 Bay Street, 4th Floor, Toronto, ON M5J 2S8</p>
  </div></div>`;
  return html;
}

export function renderNewsletter(newsletter: Newsletter, lang: string): string | null {
  const jsonFile = path.join(newsletter.absDir, `${newsletter.slug}-${lang}.json`);
  if (!fs.existsSync(jsonFile)) return null;
  const jsonData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  const templateFile = path.join(newsletter.componentDir, `${newsletter.slug}.component.html`);
  if (!fs.existsSync(templateFile)) return null;
  let template = fs.readFileSync(templateFile, 'utf8');

  const footerJsonFile = path.join(newsletter.absDir, `pe-newsletter-footer-${lang}.json`);
  let footerData = null;
  if (fs.existsSync(footerJsonFile)) footerData = JSON.parse(fs.readFileSync(footerJsonFile, 'utf8'));

  template = template.replace(
    /<app-pe-newsletter-header[^>]*>[\s\S]*?<\/app-pe-newsletter-header>/g,
    () => renderHeader(jsonData.text?.edition || '')
  );

  template = template.replace(
    /<app-pe-newsletter-footer[^>]*>[\s\S]*?<\/app-pe-newsletter-footer>/g,
    () => renderFooter(jsonData, footerData)
  );

  const contexts: Context[] = [{ newsletterContent: jsonData }];
  let html = processNgFor(template, contexts);
  html = processNgIf(html, contexts);
  html = resolveInterpolations(html, contexts);
  html = resolveBindings(html, contexts);
  html = postProcess(html);
  return html;
}

export function compileScss(newsletter: Newsletter): string {
  const scssFile = path.join(newsletter.componentDir, `${newsletter.slug}.component.scss`);
  if (!fs.existsSync(scssFile)) return '';
  try {
    let scssContent = fs.readFileSync(scssFile, 'utf8');
    scssContent = scssContent.replace(/@import\s+["'][^"']*globalVar[^"']*["']\s*;/g, '');
    scssContent = scssContent.replace(/::ng-deep\s*/g, '');
    const compiled = sass.compileString(GLOBAL_VAR_SHIM + '\n' + scssContent, { style: 'expanded' });
    return compiled.css;
  } catch (e) {
    return `/* SCSS error: ${(e as Error).message} */`;
  }
}
