import { useEffect, useRef } from 'react'

/**
 * Topology — the kaiwu.dev hero background.
 *
 * A search fans out: a root node (the query) grows filaments to sources, which
 * branch again in bursts. Nodes drift slightly; pulses of light travel along the
 * edges toward the leaves; old branches fade and the graph regrows.
 *
 * Guarantees: pure canvas, no deps, ~4 KB; empty <canvas aria-hidden> in SSR;
 * runs only while on screen and visible; 30 fps cap; pixel budget; static
 * single frame under prefers-reduced-motion.
 *
 * Graph model: `edges` are tree edges (parent → child, one per non-root node);
 * `links` are cross-links between nearby nodes (a web, not just a tree). Only
 * tree edges decide leaf-ness, so prune() can always free the oldest
 * non-root leaves and the graph keeps regrowing forever. Links are deduped and capped.
 */
type Node = { x: number; y: number; vx: number; vy: number; depth: number; born: number; parent: number; r: number }
type Pulse = { edge: number; t: number; speed: number }

export default function Topology({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const MAX_PIXELS = 2.2e6
    const MAX_LINKS = 40
    const ALPHA_LEVELS = 8
    const EDGE_ALPHA = 0.34
    const AMBER = 'rgb(245,158,11)'
    const BLUE = 'rgb(56,189,248)'
    const ROOT_GLOW_R = 18

    let w = 0, h = 0, dpr = 1
    let nodes: Node[] = []
    let edges: [number, number][] = []   // tree edges: [parent, child]
    let links: [number, number][] = []   // cross-links, oldest first
    let linkKeys = new Set<string>()     // `min-max` index pairs currently in `links`
    let pulses: Pulse[] = []
    let bucketOf = new Uint8Array(0)     // per-frame alpha bucket for edges+links (255 = skip)
    let rootGlow: CanvasGradient | null = null
    let raf = 0, last = 0, running = false, visible = true
    let nextBurst = 0
    const t0 = performance.now()
    let rect = { left: 0, top: 0 }
    const pointer = { x: -1e4, y: -1e4, active: false }

    const rnd = (a: number, b: number) => a + Math.random() * (b - a)
    const maxNodesFor = () => Math.min(260, Math.floor((w * h) / 5200))
    const linkKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`)

    function seed() {
      nodes = []; edges = []; links = []; linkKeys = new Set(); pulses = []
      // Three roots spread across the width so the graph feels wide, not centred on the copy.
      const roots = [0.18, 0.5, 0.82]
      for (const fx of roots) {
        nodes.push({ x: w * fx + rnd(-40, 40), y: h * rnd(0.25, 0.5), vx: 0, vy: 0, depth: 0, born: 0, parent: -1, r: 2.6 })
      }
      for (let i = 0; i < 6; i++) burst(0)
    }

    /** Drop the oldest cross-links beyond the cap. */
    function trimLinks() {
      while (links.length > MAX_LINKS) {
        const [a, b] = links.shift()!
        linkKeys.delete(linkKey(a, b))
      }
    }

    /** Grow a batch of branches from random existing nodes (the "one batch at a time" fan-out). */
    function burst(now: number) {
      const maxNodes = maxNodesFor()
      if (nodes.length >= maxNodes) return
      const parents: number[] = []
      for (let i = 0; i < nodes.length; i++) if (nodes[i].depth < 5) parents.push(i)
      if (!parents.length) return
      const count = Math.min(14, maxNodes - nodes.length)
      for (let i = 0; i < count; i++) {
        const idx = parents[Math.floor(Math.random() * parents.length)]
        const p = nodes[idx]
        const ang = rnd(0, Math.PI * 2)
        const len = rnd(38, 110) * (1 - p.depth * 0.08)
        const x = Math.min(w - 4, Math.max(4, p.x + Math.cos(ang) * len))
        const y = Math.min(h - 4, Math.max(4, p.y + Math.sin(ang) * len * 0.75))
        nodes.push({ x, y, vx: rnd(-0.04, 0.04), vy: rnd(-0.03, 0.03), depth: p.depth + 1, born: now, parent: idx, r: rnd(1, 1.9) })
        edges.push([idx, nodes.length - 1])
        if (Math.random() < 0.6) pulses.push({ edge: edges.length - 1, t: 0, speed: rnd(0.35, 0.8) })
      }
      // Occasionally cross-link nearby nodes so clusters look tight (a web, not just a tree).
      for (let k = 0; k < 4; k++) {
        const ai = Math.floor(Math.random() * nodes.length)
        const a = nodes[ai]
        let best = -1, bd = 90 * 90
        for (let j = 0; j < nodes.length; j++) {
          const b = nodes[j]
          if (j === ai || b.parent === ai || a.parent === j) continue
          const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2
          if (d < bd && !linkKeys.has(linkKey(ai, j))) { bd = d; best = j }
        }
        if (best >= 0) { links.push([ai, best]); linkKeys.add(linkKey(ai, best)) }
      }
      trimLinks()
    }

    function prune() {
      // Keep the graph alive: drop the oldest leaves so new batches can grow.
      const maxNodes = maxNodesFor()
      if (nodes.length < maxNodes * 0.9) return
      // Leaf-ness is decided by tree edges only; cross-links never pin a node.
      const hasChild = new Uint8Array(nodes.length)
      for (let i = 0; i < edges.length; i++) hasChild[edges[i][0]] = 1
      // Oldest non-root leaves go first, whatever their depth. Restricting this to deep leaves makes
      // shallow nodes permanent and the graph decays into a flat star (and freezes on small viewports).
      const leaves: number[] = []
      for (let i = 0; i < nodes.length; i++) if (nodes[i].depth >= 1 && !hasChild[i]) leaves.push(i)
      leaves.sort((p, q) => nodes[p].born - nodes[q].born)
      const dropCount = Math.max(6, Math.min(24, Math.floor(maxNodes * 0.1)))
      if (!leaves.length) return
      const remap = new Int32Array(nodes.length).fill(-1)
      for (let i = 0; i < Math.min(dropCount, leaves.length); i++) remap[leaves[i]] = -2
      const kept: Node[] = []
      for (let i = 0; i < nodes.length; i++) {
        if (remap[i] === -2) continue
        remap[i] = kept.length
        kept.push(nodes[i])
      }
      for (const n of kept) n.parent = n.parent >= 0 && remap[n.parent] >= 0 ? remap[n.parent] : -1
      const edgeRemap = new Int32Array(edges.length).fill(-1)
      const keptEdges: [number, number][] = []
      for (let i = 0; i < edges.length; i++) {
        const a = remap[edges[i][0]], b = remap[edges[i][1]]
        if (a >= 0 && b >= 0) { edgeRemap[i] = keptEdges.length; keptEdges.push([a, b]) }
      }
      let wi = 0
      for (let i = 0; i < pulses.length; i++) {
        const p = pulses[i]
        const e = edgeRemap[p.edge]
        if (e >= 0) { p.edge = e; pulses[wi++] = p }
      }
      pulses.length = wi
      const keptLinks: [number, number][] = []
      linkKeys = new Set()
      for (const [la, lb] of links) {
        const a = remap[la], b = remap[lb]
        if (a >= 0 && b >= 0) { keptLinks.push([a, b]); linkKeys.add(linkKey(a, b)) }
      }
      nodes = kept; edges = keptEdges; links = keptLinks
      trimLinks()
    }

    /** Sync canvas bitmap to its CSS box. Returns true only when the bitmap was actually resized (which wipes it). */
    function resize(): boolean {
      const r = canvas!.getBoundingClientRect()
      rect = { left: r.left, top: r.top }
      w = r.width; h = r.height
      dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(MAX_PIXELS / Math.max(1, w * h)))
      const bw = Math.floor(w * dpr), bh = Math.floor(h * dpr)
      const changed = bw !== canvas!.width || bh !== canvas!.height
      if (changed) { canvas!.width = bw; canvas!.height = bh }
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Root glow is position-relative: build it once here and translate() to each root when drawing.
      const g = ctx!.createRadialGradient(0, 0, 0, 0, 0, ROOT_GLOW_R)
      g.addColorStop(0, 'rgba(245,158,11,0.55)')
      g.addColorStop(1, 'rgba(245,158,11,0)')
      rootGlow = g
      if (!nodes.length && w > 0 && h > 0) seed()
      return changed
    }

    function draw(now: number) {
      const t = (now - t0) / 1000
      ctx!.clearRect(0, 0, w, h)

      // gentle drift + pointer repulsion
      for (const n of nodes) {
        if (n.depth === 0) continue
        n.x += n.vx + Math.sin(t * 0.4 + n.born) * 0.03
        n.y += n.vy + Math.cos(t * 0.3 + n.born) * 0.02
        if (pointer.active) {
          const dx = n.x - pointer.x, dy = n.y - pointer.y
          const d2 = dx * dx + dy * dy
          if (d2 < 140 * 140 && d2 > 1) { const f = (1 - Math.sqrt(d2) / 140) * 0.35; n.x += (dx / Math.sqrt(d2)) * f; n.y += (dy / Math.sqrt(d2)) * f }
        }
      }

      // edges + links — fine filaments, brighter near roots, faded at the bottom edge.
      // One strokeStyle per frame; alpha is bucketed into ALPHA_LEVELS and each bucket is a single path.
      const total = edges.length + links.length
      if (bucketOf.length < total) bucketOf = new Uint8Array(total + 64)
      for (let i = 0; i < total; i++) {
        const e = i < edges.length ? edges[i] : links[i - edges.length]
        const na = nodes[e[0]], nb = nodes[e[1]]
        if (!na || !nb) { bucketOf[i] = 255; continue }
        const age = Math.min(1, (now - nb.born) / 900)              // grow-in
        const depthFade = 1 - Math.min(nb.depth, 5) * 0.12
        const vy = 1 - Math.min(1, ((na.y + nb.y) / 2 / h) ** 2)     // vignette
        const alpha = EDGE_ALPHA * age * depthFade * vy
        bucketOf[i] = alpha < 0.015 ? 255 : Math.min(ALPHA_LEVELS - 1, Math.floor((alpha / EDGE_ALPHA) * ALPHA_LEVELS))
      }
      ctx!.lineWidth = 0.8
      ctx!.strokeStyle = BLUE
      for (let k = 0; k < ALPHA_LEVELS; k++) {
        let any = false
        ctx!.beginPath()
        for (let i = 0; i < total; i++) {
          if (bucketOf[i] !== k) continue
          const e = i < edges.length ? edges[i] : links[i - edges.length]
          const na = nodes[e[0]], nb = nodes[e[1]]
          const age = Math.min(1, (now - nb.born) / 900)
          ctx!.moveTo(na.x, na.y)
          ctx!.lineTo(na.x + (nb.x - na.x) * age, na.y + (nb.y - na.y) * age)
          any = true
        }
        if (any) { ctx!.globalAlpha = ((k + 0.5) / ALPHA_LEVELS) * EDGE_ALPHA; ctx!.stroke() }
      }

      // pulses travelling from parent to child (compacted in place — no per-frame array)
      ctx!.fillStyle = AMBER
      let wi = 0
      for (let i = 0; i < pulses.length; i++) {
        const p = pulses[i]
        p.t += p.speed / 60
        const e = edges[p.edge]
        if (!e) continue
        const na = nodes[e[0]], nb = nodes[e[1]]
        if (!na || !nb) continue
        const tt = Math.min(1, p.t)
        const x = na.x + (nb.x - na.x) * tt, y = na.y + (nb.y - na.y) * tt
        ctx!.globalAlpha = 0.9 * (1 - Math.min(1, (y / h) ** 2))
        ctx!.beginPath(); ctx!.arc(x, y, 1.6, 0, Math.PI * 2); ctx!.fill()
        if (p.t < 1) pulses[wi++] = p
      }
      pulses.length = wi

      // nodes
      for (const n of nodes) {
        const vy = 1 - Math.min(1, (n.y / h) ** 2)
        if (n.depth === 0) {
          if (rootGlow) {
            ctx!.translate(n.x, n.y)
            ctx!.globalAlpha = 1
            ctx!.fillStyle = rootGlow
            ctx!.beginPath(); ctx!.arc(0, 0, ROOT_GLOW_R, 0, Math.PI * 2); ctx!.fill()
            ctx!.translate(-n.x, -n.y)
          }
          ctx!.fillStyle = AMBER
          ctx!.globalAlpha = 0.95
          ctx!.beginPath(); ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx!.fill()
        } else {
          const age = Math.min(1, (now - n.born) / 700)
          ctx!.fillStyle = BLUE
          ctx!.globalAlpha = 0.55 * age * vy
          ctx!.beginPath(); ctx!.arc(n.x, n.y, n.r * age, 0, Math.PI * 2); ctx!.fill()
        }
      }
      ctx!.globalAlpha = 1

      if (now > nextBurst) {
        prune()
        burst(now)
        nextBurst = now + rnd(900, 1800)
      }
    }

    function frame(now: number) {
      raf = 0
      if (!running) return
      if (now - last < 33) { raf = requestAnimationFrame(frame); return }
      last = now
      draw(now)
      raf = requestAnimationFrame(frame)
    }
    const start = () => { if (running || !visible) return; running = true; last = 0; if (!raf) raf = requestAnimationFrame(frame) }
    const stop = () => { running = false; if (raf) cancelAnimationFrame(raf); raf = 0 }

    // Reduced motion: one static frame. Assigning canvas.width/height wipes the bitmap, so only
    // redraw when resize() reports a real size change (the observer's first async callback does not).
    // Static frame: bursts are stamped born=0 and drawn "5 s later" so grow-in easing is complete even right after load.
    const still = () => { for (let i = 0; i < 10; i++) burst(0); draw(performance.now() + 5000) }
    const ro = new ResizeObserver(() => { if (resize() && reduced) still() })
    ro.observe(canvas)
    if (reduced) {
      resize()
      still()
      return () => ro.disconnect()
    }
    const host = canvas.parentElement || canvas
    const onMove = (e: PointerEvent) => { pointer.x = e.clientX - rect.left; pointer.y = e.clientY - rect.top; pointer.active = true }
    const onLeave = () => { pointer.active = false }
    const onScroll = () => { const r = canvas!.getBoundingClientRect(); rect = { left: r.left, top: r.top } }
    const onVis = () => { document.hidden ? stop() : start() }
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; visible ? start() : stop() }, { threshold: 0.05 })
    io.observe(canvas)
    host.addEventListener('pointermove', onMove, { passive: true })
    host.addEventListener('pointerleave', onLeave)
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stop(); io.disconnect(); ro.disconnect()
      host.removeEventListener('pointermove', onMove); host.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('scroll', onScroll); document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 w-full h-full ${className}`} />
}
