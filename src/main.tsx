import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { initAnalytics } from './lib/track'

initAnalytics()

const app = (
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)

const root = document.getElementById('root')!
// `data-prerendered` is stamped by scripts/prerender.mjs on pages that ship real HTML;
// hydrate those, render everything else (dashboard shell) from scratch.
if (root.dataset.prerendered === 'true' && root.firstElementChild) {
  ReactDOM.hydrateRoot(root, app)
} else {
  ReactDOM.createRoot(root).render(app)
}
