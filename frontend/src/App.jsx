import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Intraday from './pages/Intraday'
import Algorithms from './pages/Algorithms'
import Setups from './pages/Setups'
import Journal from './pages/Journal'
import Analytics from './pages/Analytics'
import TelegramChat from './pages/TelegramChat'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#0f1117]">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/intraday" element={<Intraday />} />
            <Route path="/algorithms" element={<Algorithms />} />
            <Route path="/setups" element={<Setups />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/telegram" element={<TelegramChat />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}
