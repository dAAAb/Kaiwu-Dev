import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Cli from './pages/Cli'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/cli" element={<Cli />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dashboard/:section" element={<Dashboard />} />
    </Routes>
  )
}
