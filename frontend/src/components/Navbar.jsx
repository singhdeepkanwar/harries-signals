import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Target, BookOpen, BarChart3, Settings, Zap, Cpu, MessageCircle } from 'lucide-react'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/intraday', label: 'Intraday', icon: Zap },
  { to: '/algorithms', label: 'Algorithms', icon: Cpu },
  { to: '/setups', label: 'Setups', icon: Target },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/telegram', label: 'Telegram', icon: MessageCircle },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Navbar() {
  return (
    <nav className="bg-[#1a1d29] border-b border-[#2a2d3e] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">
            H
          </div>
          <span className="font-semibold text-white text-lg">Harrie's Signals</span>
        </div>
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={15} />
              <span className="hidden md:inline">{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
