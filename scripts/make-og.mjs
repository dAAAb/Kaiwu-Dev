#!/usr/bin/env node
/**
 * Generate brand images with headless Chrome (Playwright, `channel: 'chrome'`):
 *   public/og-image.png  1200×630  (Open Graph / Twitter card)
 *   public/logo.png       512×512  (Organization logo, apple-touch-icon, ERC-8004 image)
 *
 * Usage: node scripts/make-og.mjs [path-to-playwright-index.mjs]
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const PW = process.argv[2] || process.env.PLAYWRIGHT_PATH || 'playwright';
const { chromium } = await import(PW);
const OUT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'public');

const FONT = `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">`;

const LOGO_SVG = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="5" fill="#F59E0B"/><circle cx="9.5" cy="9.5" r="3.6" stroke="#0A0E1A" stroke-width="1.9"/><path d="M12.3 12.3 17 17" stroke="#0A0E1A" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="7" r="1.1" fill="#0A0E1A"/><circle cx="7" cy="17.2" r="1.1" fill="#0A0E1A"/></svg>`;

const OG_HTML = `<!doctype html><html><head><meta charset="utf-8">${FONT}
<style>
  html,body{margin:0;width:1200px;height:630px;background:#0A0E1A;color:#E8EDF5;font-family:Inter,'PingFang TC','Noto Sans TC',system-ui,sans-serif;overflow:hidden}
  .glow{position:absolute;inset:0;background:radial-gradient(55% 60% at 72% 28%,rgba(245,158,11,.22),transparent 70%)}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:40px 40px;mask-image:linear-gradient(180deg,rgba(0,0,0,.9),transparent 90%)}
  .wrap{position:relative;padding:72px 80px;height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between}
  .brand{display:flex;align-items:center;gap:14px;font-weight:600;font-size:30px;letter-spacing:-.01em}
  h1{font-size:72px;line-height:1.15;margin:0;font-weight:700;max-width:960px}
  p{font-size:28px;color:#9AA0A9;margin:22px 0 0;max-width:820px;line-height:1.35}
  .pill{display:inline-flex;gap:10px;align-items:center;font-family:'JetBrains Mono',monospace;font-size:20px;color:#FBBF24;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);border-radius:999px;padding:10px 18px}
  .row{display:flex;gap:14px;align-items:center}
  .tag{font-family:'JetBrains Mono',monospace;font-size:18px;color:#9AA0A9;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:8px 14px}
</style></head><body>
<div class="glow"></div><div class="grid"></div>
<div class="wrap">
  <div class="brand">${LOGO_SVG(44)} 開物 <span style="color:#A3AFC2;font-weight:500">Kaiwu</span></div>
  <div>
    <h1 style="letter-spacing:0">中文世界的 AI 搜尋 API</h1>
    <p>無審查、繁簡雙語、LLM-ready。一個 API call，支援 MCP、CLI、Agent Skills。限時免費。</p>
  </div>
  <div class="row">
    <span class="pill">POST kaiwu.dev/v1/search</span>
    <span class="tag">繁 · 簡</span><span class="tag">MCP</span><span class="tag">台灣部署</span>
  </div>
</div></body></html>`;

const LOGO_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:512px;height:512px;background:transparent}</style></head><body>${LOGO_SVG(512)}</body></html>`;

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await og.setContent(OG_HTML, { waitUntil: 'networkidle' });
  await og.evaluate(() => document.fonts.ready);
  writeFileSync(join(OUT, 'og-image.png'), await og.screenshot({ type: 'png' }));

  const logo = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  await logo.setContent(LOGO_HTML);
  writeFileSync(join(OUT, 'logo.png'), await logo.screenshot({ type: 'png', omitBackground: true }));
  console.log('✅ wrote public/og-image.png and public/logo.png');
} finally {
  await browser.close();
}
