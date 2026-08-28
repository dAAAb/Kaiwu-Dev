import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'

// Secondary public pages are prerendered, so their JS can load lazily: React 18 keeps the
// server markup on screen while the dehydrated <Suspense> boundary waits for the chunk.
const Cli = lazy(() => import('./pages/Cli'))
const About = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.About })))
const Contact = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.Contact })))
const Privacy = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.Privacy })))
const Developers = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.Developers })))
const NotFoundPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.NotFoundPage })))

// Auth + dashboard are lazy: public pages ship without the Privy SDK.
const PrivyApp = lazy(() => import('./PrivyApp'))
const Dashboard = lazy(() => import('./pages/Dashboard'))

const Loading = () => (
  <div className="min-h-screen bg-bg flex items-center justify-center text-fg-subtle animate-pulse">載入中…</div>
)

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/cli" element={<Cli />} />
        <Route path="/developers" element={<Developers />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/dashboard" element={<PrivyApp><Dashboard /></PrivyApp>} />
        <Route path="/dashboard/:section" element={<PrivyApp><Dashboard /></PrivyApp>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
