#!/usr/bin/env node
/**
 * Agent-readiness / SEO verification for kaiwu.dev.
 * Runs against any base URL (local `wrangler pages dev` or production).
 *
 *   node scripts/verify-site.mjs                 # https://kaiwu.dev
 *   node scripts/verify-site.mjs http://localhost:8788
 *
 * Exit code 1 on any failure. Each check is independent and reports its own evidence.
 */
const BASE = (process.argv[2] || 'https://kaiwu.dev').replace(/\/$/, '');
const API = process.env.API_BASE || BASE;

let failures = 0;
const results = [];
function check(name, ok, evidence = '') {
  results.push({ name, ok, evidence });
  if (!ok) failures++;
}
const get = (url, headers = {}) => fetch(url, { headers, redirect: 'manual' });
const textLen = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;

/* ── Homepage without JS ── */
{
  const r = await get(`${BASE}/`);
  const html = await r.text();
  check('home: 200 text/html', r.status === 200 && /text\/html/.test(r.headers.get('content-type') || ''), `${r.status} ${r.headers.get('content-type')}`);
  check('home: <h1> present', /<h1[\s>]/.test(html));
  const len = textLen(html);
  check('home: ≥500 chars of text without JS', len >= 500, `${len} chars`);
  check('home: canonical', /<link rel="canonical" href="https:\/\/kaiwu\.dev\/"/.test(html));
  check('home: <html lang>', /<html lang="zh-Hant"/.test(html));
  check('home: og:image + og:type', /property="og:image"/.test(html) && /property="og:type"/.test(html));
  check('home: JSON-LD present', /application\/ld\+json/.test(html));
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  let graph = [];
  try { const j = JSON.parse(ld[1]); graph = j['@graph'] || [j]; } catch {}
  const types = graph.map((g) => g['@type']);
  check('home: JSON-LD SoftwareApplication + Organization + FAQPage', ['SoftwareApplication', 'Organization', 'FAQPage'].every((t) => types.includes(t)), types.join(','));
  const org = graph.find((g) => g['@type'] === 'Organization') || {};
  check('home: Organization has contactPoint + address', Array.isArray(org.contactPoint) && org.contactPoint.length > 0 && !!org.address);
  check('home: mentions 開物 Kaiwu in title', /<title>[^<]*開物[^<]*Kaiwu/.test(html));
  check('home: no email obfuscation ([email protected])', !html.includes('email&#160;protected') && !html.includes('[email protected]'));
  check('home: Vary includes Accept', /accept/i.test(r.headers.get('vary') || ''), r.headers.get('vary') || '(none)');
  check('home: links to /developers', /href="\/developers/.test(html));
}

/* ── Markdown negotiation ── */
{
  const r = await get(`${BASE}/`, { accept: 'text/markdown' });
  const ct = r.headers.get('content-type') || '';
  const body = await r.text();
  check('home: Accept: text/markdown → text/markdown', r.status === 200 && ct.startsWith('text/markdown'), `${r.status} ${ct}`);
  check('home: markdown Vary: Accept', /accept/i.test(r.headers.get('vary') || ''), r.headers.get('vary') || '(none)');
  check('home: markdown starts with H1', /^(<!--[^>]*-->\s*)?# /.test(body));
  const q = await get(`${BASE}/`, { accept: 'text/html;q=0.5, text/markdown;q=0.9' });
  check('home: q-values honoured (md wins)', (q.headers.get('content-type') || '').startsWith('text/markdown'));
  const q2 = await get(`${BASE}/`, { accept: 'text/markdown;q=0.5, text/html;q=0.9' });
  check('home: q-values honoured (html wins)', (q2.headers.get('content-type') || '').startsWith('text/html'));
  const na = await get(`${BASE}/`, { accept: 'image/avif' });
  check('home: unsupported Accept → 406', na.status === 406, String(na.status));
  for (const p of ['/developers', '/about', '/contact', '/privacy']) {
    const m = await get(`${BASE}${p}`, { accept: 'text/markdown' });
    check(`${p}: markdown variant`, m.status === 200 && (m.headers.get('content-type') || '').startsWith('text/markdown'), `${m.status} ${m.headers.get('content-type')}`);
  }
}

/* ── Real 404s ── */
{
  const r = await get(`${BASE}/some-path-that-does-not-exist-${Date.now()}`);
  check('unknown path → 404', r.status === 404, String(r.status));
  const md = await get(`${BASE}/nope-${Date.now()}`, { accept: 'text/markdown' });
  const body = await md.text();
  check('unknown path (markdown) → 404 + pointers', md.status === 404 && (md.headers.get('content-type') || '').startsWith('text/markdown') && /llms\.txt/.test(body) && /sitemap/.test(body));
  const js = await get(`${BASE}/nope-${Date.now()}`, { accept: 'application/json' });
  check('unknown path (json) → 404 JSON', js.status === 404 && /application\/json/.test(js.headers.get('content-type') || ''));
  const wk = await get(`${BASE}/.well-known/does-not-exist`);
  check('unknown well-known → 404', wk.status === 404, String(wk.status));
}

/* ── Trust & developer pages ── */
for (const p of ['/about', '/contact', '/privacy', '/developers', '/cli']) {
  const r = await get(`${BASE}${p}`);
  const html = await r.text();
  const len = textLen(html);
  check(`${p}: 200 + ≥500 chars`, r.status === 200 && len >= 500, `${r.status} ${len} chars`);
  check(`${p}: canonical`, html.includes(`<link rel="canonical" href="https://kaiwu.dev${p}"`));
}
{
  const r = await get(`${BASE}/docs`);
  check('/docs → 301 /developers', r.status === 301 && /\/developers$/.test(r.headers.get('location') || ''), `${r.status} ${r.headers.get('location')}`);
}

/* ── Machine-readable files ── */
{
  const llms = await get(`${BASE}/llms.txt`);
  const t = await llms.text();
  check('llms.txt: 200 markdown', llms.status === 200 && (llms.headers.get('content-type') || '').includes('markdown'), llms.headers.get('content-type') || '');
  check('llms.txt: H1 + blockquote + when-to-use', /^# 開物 Kaiwu/m.test(t) && /^> /m.test(t) && /When to use/.test(t));
  check('llms.txt: mentions /v1/search', t.includes('/v1/search'));
  const full = await get(`${BASE}/llms-full.txt`);
  check('llms-full.txt: 200', full.status === 200, String(full.status));
  const sm = await get(`${BASE}/sitemap.xml`);
  const smt = await sm.text();
  check('sitemap.xml: urlset with /developers and /cli', sm.status === 200 && /<urlset/.test(smt) && /\/developers</.test(smt) && /\/cli</.test(smt), String(sm.status));
  const rb = await get(`${BASE}/robots.txt`);
  check('robots.txt: Sitemap + Disallow /dashboard', rb.status === 200 && /Sitemap: https:\/\/kaiwu\.dev\/sitemap\.xml/.test(await rb.text()));
  for (const f of ['agents.json', 'ai-plugin.json']) {
    const r = await get(`${BASE}/.well-known/${f}`);
    let ok = r.status === 200;
    try { JSON.parse(await r.text()); } catch { ok = false; }
    check(`.well-known/${f}: valid JSON`, ok, String(r.status));
  }
  const logo = await get(`${BASE}/logo.png`);
  check('logo.png: image/png', logo.status === 200 && /image\/png/.test(logo.headers.get('content-type') || ''), `${logo.status} ${logo.headers.get('content-type')}`);
  const og = await get(`${BASE}/og-image.png`);
  const size = Number(og.headers.get('content-length') || 0);
  check('og-image.png: image/png < 400KB', og.status === 200 && /image\/png/.test(og.headers.get('content-type') || '') && (size === 0 || size < 400_000), `${og.status} ${size}B`);
}

/* ── App routes still work ── */
{
  const d = await get(`${BASE}/dashboard`);
  const html = await d.text();
  check('/dashboard: 200 SPA shell, noindex', d.status === 200 && /<div id="root">/.test(html) && /noindex/.test(html + (d.headers.get('x-robots-tag') || '')), String(d.status));
  const d2 = await get(`${BASE}/dashboard/playground`);
  check('/dashboard/playground: 200', d2.status === 200, String(d2.status));
  if (BASE === 'https://kaiwu.dev') {
    const www = await get(`https://www.kaiwu.dev/`);
    check('www → apex 301', www.status === 301 && /^https:\/\/kaiwu\.dev\//.test(www.headers.get('location') || ''), `${www.status} ${www.headers.get('location')}`);
  }
  const inst = await get(`${BASE}/install.sh`);
  check('/install.sh: 200 shell script', inst.status === 200 && /sh|text|octet/.test(inst.headers.get('content-type') || ''), `${inst.status} ${inst.headers.get('content-type')}`);
}

/* ── API surface ── */
{
  const nf = await get(`${API}/api/definitely-not-a-route`);
  check('api: unknown /api route → JSON 404', nf.status === 404 && /json/.test(nf.headers.get('content-type') || ''), `${nf.status} ${nf.headers.get('content-type')}`);
  const nf2 = await get(`${API}/v1/definitely-not-a-route`);
  check('api: unknown /v1 route → JSON 404', nf2.status === 404 && /json/.test(nf2.headers.get('content-type') || ''), `${nf2.status} ${nf2.headers.get('content-type')}`);
  const oa = await get(`${API}/openapi.json`);
  let spec = null;
  try { spec = await oa.json(); } catch {}
  check('api: openapi.json parses', !!spec && spec.openapi?.startsWith('3.'), String(oa.status));
  if (spec) {
    const ops = [];
    for (const [p, item] of Object.entries(spec.paths || {})) for (const [m, op] of Object.entries(item)) if (typeof op === 'object' && op && op.responses) ops.push({ p, m, op });
    const withId = ops.filter((o) => o.op.operationId).length;
    const withSchema = ops.filter((o) => o.op['x-stream-response'] || Object.entries(o.op.responses || {}).some(([code, r]) => (code === '202' || code === '204') || (r?.content && Object.values(r.content).some((c) => c?.schema)))).length;
    check(`api: operationId on all ops (${withId}/${ops.length})`, ops.length > 0 && withId === ops.length);
    check(`api: response schema on all ops (${withSchema}/${ops.length})`, ops.length > 0 && withSchema === ops.length);
    check('api: components.schemas.Error', !!spec.components?.schemas?.Error);
  }
  const h = await get(`${API}/api/health`);
  check('api: /api/health 200 JSON', h.status === 200 && /json/.test(h.headers.get('content-type') || ''), String(h.status));
  const cr = await get(`${API}/v1/credits`);
  check('api: /v1/credits without key → 401 + WWW-Authenticate', cr.status === 401 && !!cr.headers.get('www-authenticate'), `${cr.status} ${cr.headers.get('www-authenticate') || '(none)'}`);
  const st = await get(`${API}/api/stats`);
  check('api: /api/stats 200 JSON', st.status === 200 && /json/.test(st.headers.get('content-type') || ''), String(st.status));
}

/* ── Report ── */
for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.evidence ? `  — ${r.evidence}` : ''}`);
console.log(`\n${results.length - failures}/${results.length} checks passed against ${BASE}`);
process.exit(failures ? 1 : 0);
