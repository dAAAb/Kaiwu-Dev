#!/usr/bin/env node
/**
 * Prerender public pages to static HTML + Markdown after `vite build`.
 *
 *   vite build                                   → dist/ (client bundle + shell)
 *   vite build --ssr src/entry-server.tsx        → dist-ssr/entry-server.js
 *   node scripts/prerender.mjs                   → this file
 *
 * Outputs (all inside dist/):
 *   index.html, about/index.html, contact/…, privacy/…, developers/…   full HTML
 *   index.md, about/index.md, …                                        Markdown variants
 *   404.html + 404.md                                                  real 404 page
 *   app.html                                                           empty SPA shell for /dashboard, /agent, /claim
 *   sitemap.xml                                                        static URLs
 *   llms-full.txt                                                      llms.txt + developers + about (Markdown)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { parse } from 'node-html-parser';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SITE = 'https://kaiwu.dev';
const OG_IMAGE = `${SITE}/og-image.png`;

// The pristine Vite shell is saved on first run so re-running prerender is idempotent.
const SHELL_COPY = join(ROOT, 'dist-ssr', '.shell.html');
let shell = readFileSync(join(DIST, 'index.html'), 'utf-8');
if (shell.includes('<div id="root"></div>')) {
  writeFileSync(SHELL_COPY, shell);
} else if (existsSync(SHELL_COPY)) {
  shell = readFileSync(SHELL_COPY, 'utf-8');
} else {
  throw new Error('dist/index.html is already prerendered and no dist/.shell.html exists — run `vite build` first');
}

const { renderAll } = await import(pathToFileURL(join(ROOT, 'dist-ssr', 'entry-server.js')).href);
const pages = renderAll();

/* ───────────────── helpers ───────────────── */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function headFor(page) {
  const url = page.status === 404 ? `${SITE}/404` : `${SITE}${page.path === '/' ? '/' : page.path}`;
  const mdHref = page.path === '/' ? '/index.md' : page.status === 404 ? '/404.md' : `${page.path}/index.md`;
  const robots = page.status === 404 ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1';
  return [
    `<meta name="description" content="${esc(page.meta.description)}" />`,
    `<meta name="robots" content="${robots}" />`,
    page.status === 404 ? '' : `<link rel="canonical" href="${url}" />`,
    `<link rel="alternate" type="text/markdown" href="${mdHref}" />`,
    `<meta property="og:type" content="${page.meta.type || 'website'}" />`,
    `<meta property="og:site_name" content="開物 Kaiwu" />`,
    `<meta property="og:locale" content="zh_TW" />`,
    `<meta property="og:title" content="${esc(page.meta.title)}" />`,
    `<meta property="og:description" content="${esc(page.meta.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="開物 Kaiwu — 中文世界的 AI 搜尋 API" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(page.meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.meta.description)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
    `<script type="application/ld+json">${JSON.stringify(page.jsonLd).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean).join('\n    ');
}

function buildHtml(page) {
  let html = shell;
  html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(page.meta.title)}</title>`);
  html = html.replace(/\s*<meta name="description"[^>]*>/, '');
  html = html.replace('</head>', () => `    ${headFor(page)}\n  </head>`);
  // Cloudflare's Email Address Obfuscation would otherwise rewrite example addresses
  // to "[email protected]" for crawlers; email_off comments disable it for the region.
  html = html.replace(
    '<div id="root"></div>',
    () => `<!--email_off--><div id="root" data-prerendered="true">${page.html}</div><!--/email_off-->`,
  );
  return html;
}

/* ───────────── HTML → Markdown (subset used by our pages) ───────────── */

function toMarkdown(rootHtml, page) {
  // Note: node-html-parser keeps <pre> as a raw-text block; we strip its inner tags below.
  const doc = parse(`<div id="__root">${rootHtml}</div>`);
  // Drop chrome that is not content.
  // Site chrome only: the sticky nav header and the footer live outside <main>.
  doc.querySelectorAll('header').forEach((n) => { if (!n.closest('main')) n.remove(); });
  for (const sel of ['footer', 'canvas', 'svg', 'style', 'script', 'button[aria-label]', '[role="tablist"]', '[aria-hidden="true"]', '[aria-busy="true"]', '[data-md-skip]', 'input', 'textarea', 'select', '.eyebrow']) {
    doc.querySelectorAll(sel).forEach((n) => n.remove());
  }
  const main = doc.querySelector('main') || doc.querySelector('#__root');
  const decode = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

  const text = (n) => n.text.replace(/\s+/g, ' ').trim();
  const inline = (n) => {
    if (n.nodeType === 3) return n.rawText.replace(/\s+/g, ' ');
    const tag = n.tagName?.toLowerCase();
    const inner = () => n.childNodes.map(inline).join('');
    switch (tag) {
      case 'a': {
        const href = n.getAttribute('href') || '';
        const abs = href.startsWith('/') ? SITE + href : href.startsWith('#') ? `${SITE}${page.path}${href}` : href;
        // Link cards: a title plus block-level description(s) → "[title](url) — description".
        const blocks = n.querySelectorAll('p, .block');
        if (blocks.length) {
          const desc = blocks.map((b) => text(b)).filter(Boolean).join(' — ');
          blocks.forEach((b) => b.remove());
          const label = inner().replace(/\s+/g, ' ').trim();
          return label ? `[${label}](${abs})${desc ? ' — ' + desc : ''}` : desc;
        }
        const label = inner().trim();
        return label ? `[${label}](${abs})` : '';
      }
      case 'strong': case 'b': return `**${inner().trim()}**`;
      case 'em': case 'i': return `*${inner().trim()}*`;
      case 'code': return `\`${text(n)}\``;
      case 'br': return '  \n';
      case 'img': return n.getAttribute('alt') ? `![${n.getAttribute('alt')}](${n.getAttribute('src')})` : '';
      case 'span': case 'small': case 'label': case 'time': case 'dt': case 'dd': { const t = inner(); return /badge/.test(n.getAttribute('class') || '') ? ` ${t.trim()} ` : t; }
      default: return inner();
    }
  };

  const out = [];
  const walk = (n, depth = 0) => {
    if (n.nodeType === 3) { const t = n.rawText.trim(); if (t) out.push(t); return; }
    const tag = n.tagName?.toLowerCase();
    switch (tag) {
      case 'h1': out.push(`# ${text(n)}`); return;
      case 'h2': out.push(`## ${text(n)}`); return;
      case 'h3': out.push(`### ${text(n)}`); return;
      case 'h4': out.push(`#### ${text(n)}`); return;
      case 'p': { const t = inline(n).replace(/\s+/g, ' ').trim(); if (t) out.push(t); return; }
      case 'button': { const t = text(n); if (t) out.push(`### ${t}`); return; }
      case 'a': {
        // Link "cards" contain a heading + description; plain links are inline.
        const h = n.querySelector('h2, h3, h4');
        if (h) {
          const href = n.getAttribute('href') || '';
          const abs = href.startsWith('/') ? SITE + href : href;
          out.push(`### [${text(h)}](${abs})`);
          n.querySelectorAll('p, blockquote').forEach((c) => { const t = inline(c).replace(/\s+/g, ' ').trim(); if (t) out.push(t); });
        } else {
          const t = inline(n).trim(); if (t) out.push(t);
        }
        return;
      }
      case 'pre': { const code = decode(n.innerHTML.replace(/<[^>]+>/g, '')).replace(/\n$/, ''); if (code.trim()) out.push('```\n' + code + '\n```'); return; }
      case 'blockquote': out.push(`> ${inline(n).trim()}`); return;
      case 'ul': case 'ol': {
        const items = n.childNodes.filter((c) => c.tagName?.toLowerCase() === 'li');
        const lines = items.map((li, i) => {
          const bullet = tag === 'ol' ? `${i + 1}.` : '-';
          // A list item may contain block children (headings, paragraphs); flatten them.
          const parts = [];
          let run = '';
          const flush = () => { const t = run.replace(/\s+/g, ' ').trim(); if (t) parts.push(t); run = ''; };
          const collect = (c) => {
            if (c.nodeType === 3) { run += c.rawText; return; }
            const ct = c.tagName?.toLowerCase();
            if (['h2', 'h3', 'h4'].includes(ct)) { flush(); parts.push(`**${text(c)}**`); }
            else if (['p', 'blockquote'].includes(ct)) { flush(); const t = inline(c).replace(/\s+/g, ' ').trim(); if (t) parts.push(t); }
            else if (['ul', 'ol'].includes(ct)) { flush(); c.childNodes.filter((x) => x.tagName?.toLowerCase() === 'li').forEach((x) => parts.push(`- ${inline(x).replace(/\s+/g, ' ').trim()}`)); }
            else if (ct === 'pre') { flush(); const code = decode(c.innerHTML.replace(/<[^>]+>/g, '')).replace(/\n$/, ''); if (code.trim()) parts.push('\n```\n' + code + '\n```'); }
            else if (['div', 'dl', 'section', 'article', 'li'].includes(ct)) { c.childNodes.forEach(collect); }
            else if (['svg', 'button', 'input'].includes(ct)) { /* skip */ }
            else if (ct === 'span' && /^\d{1,2}$/.test(c.text.trim())) { /* step-number badge */ }
            else { run += inline(c); }
          };
          li.childNodes.forEach(collect);
          flush();
          // Fenced code blocks sit on their own lines; other parts are joined with " — ".
          let line = '';
          for (const part of parts) {
            if (part.startsWith('\n```')) line += part + '\n';
            else line += (line && !line.endsWith('\n') ? ' — ' : '') + part;
          }
          return `${'  '.repeat(depth)}${bullet} ${line.replace(/\n$/, '')}`;
        });
        out.push(lines.join('\n'));
        return;
      }
      case 'table': {
        const rows = n.querySelectorAll('tr');
        const md = rows.map((tr, i) => {
          const cells = tr.childNodes.filter((c) => ['th', 'td'].includes(c.tagName?.toLowerCase()));
          const line = `| ${cells.map((c) => inline(c).trim().replace(/\|/g, '\\|')).join(' | ')} |`;
          return i === 0 ? `${line}\n| ${cells.map(() => '---').join(' | ')} |` : line;
        });
        out.push(md.join('\n'));
        return;
      }
      case 'dl': {
        const lines = [];
        let dt = '';
        n.childNodes.forEach((c) => {
          const ct = c.tagName?.toLowerCase();
          if (ct === 'dt') dt = inline(c).trim();
          else if (ct === 'dd') lines.push(`- **${dt}**: ${inline(c).trim()}`);
          else c.childNodes.forEach((x) => { const xt = x.tagName?.toLowerCase(); if (xt === 'dt') dt = inline(x).trim(); if (xt === 'dd') lines.push(`- **${dt}**: ${inline(x).trim()}`); });
        });
        if (lines.length) out.push(lines.join('\n'));
        return;
      }
      case 'form': { const lbl = n.querySelector('label'); if (lbl) out.push(`*${text(lbl)}* — 請到 ${SITE}/dashboard 操作。`); return; }
      case 'input': case 'textarea': case 'select': return;
      default:
        n.childNodes.forEach((c) => walk(c, depth));
    }
  };
  walk(main);

  for (let i = 0; i < out.length; i++) out[i] = decode(out[i]);
  const pageUrl = `${SITE}${page.path === '/404' ? '/404' : page.path}`;
  const h1Index = out.findIndex((l) => l.startsWith('# '));
  const h1 = h1Index >= 0 ? out[h1Index].slice(2) : page.meta.title;
  const body = out.filter((_, i) => i !== h1Index);
  const frontmatter = [
    `# ${h1}`,
    `> ${page.meta.description}`,
    `來源 Source: ${pageUrl} · 標題 Title: ${page.meta.title} · 本文件為 \`Accept: text/markdown\` 的 Markdown 版本`,
  ];
  const md = frontmatter.concat(body).join('\n\n').replace(/\n{3,}/g, '\n\n') + '\n';
  return md;
}

/* ───────────────── write pages ───────────────── */

const written = [];
for (const page of pages) {
  const out = join(DIST, page.outFile);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buildHtml(page));
  const mdPath = page.outFile.replace(/\.html$/, '.md');
  writeFileSync(join(DIST, mdPath), toMarkdown(page.html, page));
  written.push(`${page.outFile} (+ ${mdPath})`);
}

/* SPA shell for client-only routes — generic, noindex. */
{
  let app = shell.replace(/<title>[^<]*<\/title>/, '<title>開物 Kaiwu 儀表板</title>');
  app = app.replace('</head>', () => `    <meta name="robots" content="noindex" />\n    <meta property="og:site_name" content="開物 Kaiwu" />\n    <meta property="og:image" content="${OG_IMAGE}" />\n  </head>`);
  writeFileSync(join(DIST, 'app.html'), app);
  written.push('app.html');
}

/* sitemap.xml — static pages */
{
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE}/`, priority: '1.0', changefreq: 'weekly', lastmod: today },
    { loc: `${SITE}/developers`, priority: '0.9', changefreq: 'weekly', lastmod: today },
    { loc: `${SITE}/cli`, priority: '0.8', changefreq: 'monthly', lastmod: today },
    { loc: `${SITE}/about`, priority: '0.6', changefreq: 'monthly', lastmod: today },
    { loc: `${SITE}/contact`, priority: '0.5', changefreq: 'monthly', lastmod: today },
    { loc: `${SITE}/privacy`, priority: '0.3', changefreq: 'yearly', lastmod: today },
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`)
    .join('\n')}\n</urlset>\n`;
  writeFileSync(join(DIST, 'sitemap.xml'), xml);
  written.push(`sitemap.xml (${urls.length} urls)`);
}

/* llms-full.txt — llms.txt followed by the developer docs, CLI docs and about page in Markdown */
{
  const llms = readFileSync(join(DIST, 'llms.txt'), 'utf-8');
  const dev = readFileSync(join(DIST, 'developers', 'index.md'), 'utf-8');
  const cli = readFileSync(join(DIST, 'cli', 'index.md'), 'utf-8');
  const about = readFileSync(join(DIST, 'about', 'index.md'), 'utf-8');
  writeFileSync(join(DIST, 'llms-full.txt'), [llms.trim(), '\n\n---\n', dev.trim(), '\n\n---\n', cli.trim(), '\n\n---\n', about.trim(), '\n'].join(''));
  written.push('llms-full.txt');
}

console.log('✅ prerender:\n  ' + written.join('\n  '));
