# 開物 Kaiwu Design System (2026-08)

Single source of truth for the kaiwu.dev UI. Every page (Landing, Developers, CLI, About,
Contact, Privacy, 404, Dashboard) uses these tokens and component classes — no ad-hoc
colours, no emoji icons, no inline `<style>` blocks.

## 1. Concept — 天工開物 × 搜尋拓樸

- **Brand**: 開物 Kaiwu — 中文世界的 AI 搜尋 API. Name from《天工開物》(1637): craft that
  reveals how things work. Positioning: uncensored, bilingual (繁/簡), LLM-ready, Taiwan-hosted.
- **Visual metaphor**: a search *fans out* — one query becomes many filaments reaching
  sources, which branch again. The hero background is a living topology graph: fine
  filaments, tight clusters, new branches growing in batches. Amber is the spark
  (the query / the answer); cool "filament" blue is the network.
- **Voice**: 繁體中文優先，技術名詞保留英文（API、MCP、CLI、agent）。句子短、具體、有數字。
  Tone: 工程師對工程師，誠實不浮誇（首頁數字有 baseline 偏移，文案用「已處理」而非「真實」保證）。
- No emoji as UI icons (they may stay in *user content*). Use `src/components/Icons.tsx`.

## 2. Tokens (Tailwind + CSS variables in `src/index.css`)

| Token | Value | Use |
|---|---|---|
| `bg` | `#0A0E1A` | page (ink navy — keep, it is the brand) |
| `surface` | `#111827` | cards, sidebar, inputs |
| `surface-2` | `#182135` | nested cards, hover rows, code |
| `line` | `rgba(148,163,184,.14)` | default borders |
| `line-strong` | `rgba(148,163,184,.28)` | hover/focus |
| `fg` | `#E8EDF5` | primary text |
| `fg-muted` | `#A3AFC2` | secondary text (AA on surface) |
| `fg-subtle` | `#7C8AA3` | tertiary — only ≥ 12 px |
| `accent` | `#F59E0B` | amber — primary actions, brand marks, the "spark" |
| `accent-hover` | `#FBBF24` | |
| `accent-soft` | `rgba(245,158,11,.12)` | tints |
| `filament` | `#38BDF8` | network lines, links in code, secondary emphasis |
| `filament-soft` | `rgba(56,189,248,.12)` | |
| `success` | `#22C55E` · `warning` `#F59E0B` · `danger` `#EF4444` | |

Tailwind names: `bg-bg`, `bg-surface`, `bg-surface-2`, `border-line`, `text-fg`,
`text-fg-muted`, `text-fg-subtle`, `bg-accent`, `text-accent`, `bg-accent-soft`,
`text-filament`, `bg-filament-soft`. Legacy `border`, `muted`, `accent2` still resolve.

Contrast rules: `fg-subtle` (#7C8AA3) is 4.6:1 on `bg` — never smaller than 12 px.
Amber text on `bg` is 8.9:1 (fine); amber text on `accent-soft` tints is fine.

## 3. Typography (Chinese-first)

- Sans stack: `Inter, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif`
  (Inter self-hosted for Latin/digits; CJK from the OS — no 4 MB webfont).
- Mono: `"JetBrains Mono", ui-monospace, Menlo, monospace` (self-hosted).
- CJK rules: body `leading-[1.8]`, headings `leading-[1.25]`, **no negative tracking on
  Chinese headings** (`tracking-normal`; only Latin display text may use `tracking-tight`).
  `text-wrap: balance` on headings; `word-break: keep-all` off (Chinese wraps per character).
- Fluid sizes: `text-display` (clamp 2.5rem→4.5rem), `text-h1` (1.875→3rem), `text-h2`
  (1.5→2.125rem), `text-h3` 1.25rem. Body 16 px (17 px on landing), dashboard 15 px.
- Bilingual eyebrows: `.eyebrow` = 12 px uppercase Latin + `·` + Chinese, e.g.
  `HOW IT WORKS · 運作方式`.

## 4. Component classes (`src/index.css` `@layer components`)

`.btn` `.btn-primary` (amber bg, ink text) `.btn-secondary` `.btn-ghost` `.btn-danger`
`.btn-sm` `.btn-lg` `.btn-icon` · `.card` `.card-inset` `.card-hover` · `.input` `.input-lg`
`.input-mono` `.textarea` `.field-label` `.field-hint` `.input-group` · `.badge`
`.badge-accent` `.badge-filament` `.badge-success` `.badge-warning` `.badge-danger`
`.badge-neutral` · `.eyebrow` `.link` · `.container-x` (max-w-6xl) `.section`
`.table-wrap` `.divider` · `.skeleton` · `.prose-kaiwu` · `.code-panel`

Rules: radius 8 px controls / 16 px cards; borders `border-line`; one radial amber glow
per page (hero) plus the topology canvas — no gradient cards; no shadows except modals.
Motion: `transition-colors 150ms`; respect `prefers-reduced-motion`.

## 5. Layout & RWD

Mobile-first; breakpoints sm 640 / md 768 / lg 1024. Every row with text + controls wraps.
Tables inside `.table-wrap`. No horizontal scroll at 360 px. Inputs ≥ 40 px, 16 px font.
Landing sections: `.section .container-x`, copy `max-w-2xl`. Hero: two columns on `lg`
(copy + CTAs left, agent quickstart panel right), stacked below; topology canvas behind.
Dashboard: sidebar 256 px on `md+`; below `md` a 48 px app bar + slide-in drawer
(focus moves in, Escape closes, body scroll locked).

## 6. Conversion

- Hero: two primary paths — **免費開始（登入拿金鑰）** and **給 agent 的 prompt**；microcopy
  「限時免費 · 每月 1,000 額度 · 不用信用卡」.
- "限時免費" banner replaces paywalls: paid tiers show 即將推出 + 限時免費 notice; never a
  dead "Upgrade" button.
- Playground on the landing? No — keep the dashboard playground; landing shows a *real*
  sample response (static JSON) so the value is visible without login.
- Track: `cta_click{placement}`, `code_copy{lang}`, `signup_start` via `src/lib/track.ts`.

## 7. Icons

`Icon.Search .Spark .Globe .Shield .Terminal .Plug .Layers .Key .Credits .Play .Settings
.Book .Copy .Check .Close .Menu .ArrowRight .ArrowLeft .ChevronDown .ExternalLink .Warning
.Info .Trash .Eye .EyeOff .Refresh .Plus .Logo .Github .Mail .Users .ChartBar .Lock`.
