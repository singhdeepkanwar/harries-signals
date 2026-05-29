import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, RotateCcw, Activity, IndianRupee, RefreshCw, Loader } from 'lucide-react'
import SetupCard from '../components/SetupCard'

export default function Dashboard() {
  const [setups, setSetups] = useState([])
  const [trades, setTrades] = useState([])
  const [summary, setSummary] = useState(null)
  const [scanStatus, setScanStatus] = useState(null)
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(() => {
    Promise.all([
      fetch('/api/setups/today').then(r => r.json()),
      fetch('/api/trades').then(r => r.json()),
      fetch('/api/analytics/summary').then(r => r.json()),
      fetch('/api/scan/status').then(r => r.json()),
      fetch('/api/config').then(r => r.json()),
    ])
      .then(([s, t, sum, scan, cfg]) => {
        setSetups(s)
        setTrades(t)
        setSummary(sum)
        setScanStatus(scan)
        setConfig(cfg)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [fetchData])

  const triggerScan = () => {
    fetch('/api/scan/trigger', { method: 'POST' })
      .then(r => r.json())
      .then(() => fetchData())
  }

  const breakoutSetups = setups.filter(s => s.strategy === 'BREAKOUT')
  const reversalSetups = setups.filter(s => s.strategy === 'REVERSAL')
  const openTrades = trades.filter(t => !t.exit_price)

  const topBreakouts = [...breakoutSetups].sort((a, b) => b.confirmation_score - a.confirmation_score).slice(0, 3)
  const topReversals = [...reversalSetups].sort((a, b) => b.confirmation_score - a.confirmation_score).slice(0, 3)

  // Monthly P&L
  const now = new Date()
  const monthTrades = trades.filter(t => {
    if (!t.exit_date || !t.pnl) return false
    const d = new Date(t.exit_date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const monthPnl = monthTrades.reduce((s, t) => s + (t.pnl || 0), 0)

  const paperMode = config.paper_trade_mode === 'true'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="animate-spin text-blue-500" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {paperMode && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-lg text-sm text-center">
          Paper Trade Mode Active
        </div>
      )}

      {/* Scan Status Bar */}
      {scanStatus?.running && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm text-blue-400 mb-2">
            <span className="flex items-center gap-2">
              <Loader className="animate-spin" size={14} />
              Scanning {scanStatus.current_symbol}...
            </span>
            <span>{scanStatus.progress} / {scanStatus.total}</span>
          </div>
          <div className="w-full bg-blue-900/30 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${scanStatus.total ? (scanStatus.progress / scanStatus.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] p-4">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <TrendingUp size={18} />
            <span className="text-xs text-gray-500">Breakout Setups</span>
          </div>
          <div className="text-2xl font-bold text-white">{breakoutSetups.length}</div>
        </div>
        <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] p-4">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <RotateCcw size={18} />
            <span className="text-xs text-gray-500">Reversal Setups</span>
          </div>
          <div className="text-2xl font-bold text-white">{reversalSetups.length}</div>
        </div>
        <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Activity size={18} />
            <span className="text-xs text-gray-500">Open Trades</span>
          </div>
          <div className="text-2xl font-bold text-white">{openTrades.length}</div>
        </div>
        <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] p-4">
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee size={18} className={monthPnl >= 0 ? 'text-green-400' : 'text-red-400'} />
            <span className="text-xs text-gray-500">Month P&L</span>
          </div>
          <div className={`text-2xl font-bold ${monthPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {monthPnl.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
          </div>
        </div>
      </div>

      {/* Scan Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg">Today's Top Setups</h2>
        <button
          onClick={triggerScan}
          disabled={scanStatus?.running}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
        >
          <RefreshCw size={14} className={scanStatus?.running ? 'animate-spin' : ''} />
          {scanStatus?.running ? 'Scanning...' : 'Run Scan'}
        </button>
      </div>

      {/* Top Setups Grid */}
      {setups.length === 0 ? (
        <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] p-8 text-center">
          <p className="text-gray-500 mb-2">No setups found today</p>
          <p className="text-gray-600 text-sm">Run a scan to find trading setups</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...topBreakouts, ...topReversals].map((setup, i) => (
            <SetupCard key={`${setup.symbol}-${setup.strategy}-${i}`} setup={setup} onTradeLogged={fetchData} />
          ))}
        </div>
      )}

      {/* Open Trades Table */}
      {openTrades.length > 0 && (
        <div>
          <h2 className="text-white font-semibold text-lg mb-3">Open Trades</h2>
          <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2d3e] text-gray-500 text-xs">
                  <th className="text-left p-3">Symbol</th>
                  <th className="text-left p-3">Strategy</th>
                  <th className="text-right p-3">Entry</th>
                  <th className="text-right p-3">Qty</th>
                  <th className="text-right p-3">Stop Loss</th>
                  <th className="text-right p-3">Target 1</th>
                  <th className="text-right p-3">Capital</th>
                </tr>
              </thead>
              <tbody>
                {openTrades.map(t => (
                  <tr key={t.id} className="border-b border-[#2a2d3e]/50 hover:bg-[#252838]">
                    <td className="p-3 text-white font-medium">{t.symbol}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${t.strategy === 'BREAKOUT' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {t.strategy}
                      </span>
                    </td>
                    <td className="p-3 text-right text-white">{t.entry_price?.toFixed(2)}</td>
                    <td className="p-3 text-right text-white">{t.quantity}</td>
                    <td className="p-3 text-right text-red-400">{t.stop_loss?.toFixed(2)}</td>
                    <td className="p-3 text-right text-green-400">{t.target_1?.toFixed(2)}</td>
                    <td className="p-3 text-right text-gray-400">
                      {t.capital_deployed?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
