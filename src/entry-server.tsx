/**
 * Server-side entry used by scripts/prerender.mjs at build time.
 * Renders the public pages to static HTML (the same markup the client hydrates)
 * and returns <head> metadata + JSON-LD from one source of truth.
 */
import { Suspense } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import Landing, { FAQ, LANDING_META } from './pages/Landing'
import Cli, { CLI_META } from './pages/Cli'
import { PLANS } from './lib/plans'
import { About, Contact, Privacy, Developers, NotFoundPage, ABOUT_META, CONTACT_META, PRIVACY_META, DEVELOPERS_META, NOTFOUND_META, type PageMeta } from './pages/StaticPages'

const SITE = 'https://kaiwu.dev'

const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE}/#organization`,
  name: '開物 Kaiwu',
  alternateName: ['Kaiwu', '開物', 'Kaiwu 開物', 'kaiwu.dev'],
  url: `${SITE}/`,
  logo: { '@type': 'ImageObject', url: `${SITE}/logo.png`, width: 512, height: 512 },
  description: '專為 AI agent 打造的中文搜尋 API：無審查、繁簡雙語、LLM-ready，台灣部署。',
  foundingDate: '2026',
  email: 'hello@kaiwu.dev',
  contactPoint: [
    { '@type': 'ContactPoint', contactType: 'customer support', email: 'hello@kaiwu.dev', url: `${SITE}/contact`, availableLanguage: ['zh-Hant', 'zh-Hans', 'en'] },
    { '@type': 'ContactPoint', contactType: 'technical support', email: 'hello@kaiwu.dev', url: `${SITE}/developers`, availableLanguage: ['zh-Hant', 'en'] },
  ],
  address: { '@type': 'PostalAddress', addressLocality: '台北', addressRegion: '台灣', addressCountry: 'TW' },
  sameAs: ['https://github.com/dAAAb/Kaiwu-Dev', 'https://www.npmjs.com/package/@kaiwu/cli', 'https://canfly.ai'],
}

const WEBSITE = { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: '開物 Kaiwu', alternateName: 'Kaiwu', publisher: { '@id': `${SITE}/#organization` }, inLanguage: 'zh-Hant' }

const SOFTWARE = {
  '@type': 'SoftwareApplication',
  '@id': `${SITE}/#software`,
  name: '開物 Kaiwu API',
  alternateName: 'Kaiwu Search API',
  url: `${SITE}/`,
  description: LANDING_META.description,
  applicationCategory: 'DeveloperApplication',
  applicationSubCategory: 'Web search API for AI agents',
  operatingSystem: 'Any',
  softwareVersion: '1.0.0',
  inLanguage: ['zh-Hant', 'zh-Hans', 'en'],
  offers: PLANS.map((p) => ({
    '@type': 'Offer',
    name: p.available ? `${p.name}（${p.period}）` : p.name,
    price: p.price.replace(/[^0-9.]/g, ''),
    priceCurrency: 'USD',
    description: `每月 ${p.credits.toLocaleString('en-US')} 額度；${p.features.slice(1).join('、')}${p.available ? '' : '（籌備中，即將推出）'}。`,
    availability: p.available ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
  })),
  featureList: ['無審查的中文網路搜尋', '繁體／簡體用語自動互查', 'LLM-ready 正文與綜合答案', 'REST API', 'MCP Server', 'CLI (kw)', 'Claude Code / Cursor Agent Skills', 'OpenAPI 3.1 規格', '台灣部署'],
  author: { '@id': `${SITE}/#organization` },
  publisher: { '@id': `${SITE}/#organization` },
}

const faqJsonLd = () => ({ '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) })
const webPage = (meta: PageMeta, extra: Record<string, unknown> = {}) => ({ '@type': 'WebPage', '@id': `${SITE}${meta.path}#webpage`, url: `${SITE}${meta.path}`, name: meta.title, description: meta.description, isPartOf: { '@id': `${SITE}/#website` }, about: { '@id': `${SITE}/#organization` }, inLanguage: 'zh-Hant', ...extra })
const breadcrumb = (meta: PageMeta, label: string) => ({ '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '開物 Kaiwu', item: `${SITE}/` }, { '@type': 'ListItem', position: 2, name: label, item: `${SITE}${meta.path}` }] })

export type RenderedPage = { path: string; outFile: string; html: string; meta: PageMeta; jsonLd: unknown; status: number }

function render(element: React.ReactElement, path: string) {
  // Mirror App.tsx: the client tree wraps routes in <Suspense>, so the server must emit the same boundary markers.
  return renderToString(<StaticRouter location={path}><Suspense fallback={null}>{element}</Suspense></StaticRouter>)
}

export function renderAll(): RenderedPage[] {
  const pages: RenderedPage[] = []
  const home: PageMeta = { path: '/', title: LANDING_META.title, description: LANDING_META.description }
  pages.push({ path: '/', outFile: 'index.html', html: render(<Landing />, '/'), meta: home, jsonLd: { '@context': 'https://schema.org', '@graph': [ORGANIZATION, WEBSITE, SOFTWARE, webPage(home, { mainEntity: { '@id': `${SITE}/#software` } }), faqJsonLd()] }, status: 200 })

  const statics: [PageMeta, React.ReactElement, string][] = [
    [CLI_META, <Cli />, 'CLI & Skills'],
    [DEVELOPERS_META, <Developers />, '開發者文件'],
    [ABOUT_META, <About />, '關於'],
    [CONTACT_META, <Contact />, '聯絡'],
    [PRIVACY_META, <Privacy />, '隱私權政策'],
  ]
  for (const [meta, el, label] of statics) {
    pages.push({ path: meta.path, outFile: `${meta.path.slice(1)}/index.html`, html: render(el, meta.path), meta, jsonLd: { '@context': 'https://schema.org', '@graph': [ORGANIZATION, WEBSITE, webPage(meta), breadcrumb(meta, label)] }, status: 200 })
  }
  pages.push({ path: '/404', outFile: '404.html', html: render(<NotFoundPage />, '/this-page-does-not-exist'), meta: NOTFOUND_META, jsonLd: { '@context': 'https://schema.org', '@graph': [ORGANIZATION, WEBSITE] }, status: 404 })
  return pages
}
