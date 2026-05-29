import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import TradeForm from '../components/TradeForm'

export default function Journal() {
  const [trades, setTrades] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [exitingTrade, setExitingTrade] = useState(null)
  const [exitForm, setExitForm] = useState({ exit_date: '', exit_price: '', exit_type: 'MANUAL' })

  const fetchTrades = () => {
    fetch('/api/trades').then(r => r.json()).then(setTrades).catch(() => {})
  }

  useEffect(() => { fetchTrades() }, [])

  const submitExit = async (tradeId) => {
    await fetch(`/api/trades/${tradeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exit_date: exitForm.exit_date,
        exit_price: parseFloat(exitForm.exit_price),
        exit_type: exitForm.exit_type,
      }),
    })
    setExitingTrade(null)
    setExitForm({ exit_date: '', exit_price: '', exit_type: 'MANUAL' })
    fetchTrades()
  }

  const openTrades = trades.filter(t => !t.exit_price)
  const closedTrades = trades.filter(t => t.exit_price)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-white font-semibold text-xl">Trade Journal</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
        >
          <Plus size={16} />
          Log Trade
        </button>
      </div>

      {showForm && (
        <TradeForm
          onClose={() => setShowForm(false)}
          onSubmit={() => { setShowForm(false); fetchTrades() }}
        />
      )}

      {/* Open Trades */}
      {openTrades.length > 0 && (
        <div>
          <h2 className="text-white font-medium mb-3">Open Trades ({openTrades.length})</h2>
          <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2d3e] text-gray-500 text-xs">
                  <th className="text-left p-3">Symbol</th>
                  <th className="text-left p-3">Strategy</th>
                  <th className="text-right p-3">Entry Date</th>
                  <th className="text-right p-3">Entry</th>
                  <th className="text-right p-3">Qty</th>
                  <th className="text-right p-3">SL</th>
                  <th className="text-right p-3">T1</th>
                  <th className="text-right p-3">Risk</th>
                  <th className="text-center p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {openTrades.map(t => (
                  <>
                    <tr key={t.id} className="border-b border-[#2a2d3e]/50 hover:bg-[#252838] bg-yellow-500/5">
                      <td className="p-3 text-white font-medium">
                        {t.symbol}
                        {t.is_paper_trade && <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">Paper</span>}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${t.strategy === 'BREAKOUT' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {t.strategy}
                        </span>
                      </td>
                      <td className="p-3 text-right text-gray-400">{t.entry_date}</td>
                      <td className="p-3 text-right text-white">{t.entry_price?.toFixed(2)}</td>
                      <td className="p-3 text-right text-white">{t.quantity}</td>
                      <td className="p-3 text-right text-red-400">{t.stop_loss?.toFixed(2)}</td>
                      <td className="p-3 text-right text-green-400">{t.target_1?.toFixed(2)}</td>
                      <td className="p-3 text-right text-gray-400">
                        {t.risk_amount?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setExitingTrade(exitingTrade === t.id ? null : t.id)}
                          className="px-3 py-1 bg-red-600/20 text-red-400 rounded text-xs hover:bg-red-600/30"
                        >
                          Exit
                        </button>
                      </td>
                    </tr>
                    {exitingTrade === t.id && (
                      <tr key={`${t.id}-exit`}>
                        <td colSpan={9} className="p-4 bg-[#151723]">
                          <div className="flex items-end gap-3">
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Exit Date</label>
                              <input
                                type="date"
                                value={exitForm.exit_date}
                                onChange={e => setExitForm(f => ({ ...f, exit_date: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Exit Price</label>
                              <input
                                type="number"
                                step="0.01"
                                value={exitForm.exit_price}
                                onChange={e => setExitForm(f => ({ ...f, exit_price: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Exit Type</label>
                              <select
                                value={exitForm.exit_type}
                                onChange={e => setExitForm(f => ({ ...f, exit_type: e.target.value }))}
                              >
                                <option value="SL">SL Hit</option>
                                <option value="TARGET1">Target 1</option>
                                <option value="TARGET2">Target 2</option>
                                <option value="MANUAL">Manual</option>
                              </select>
                            </div>
                            <button
                              onClick={() => submitExit(t.id)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                            >
                              Save Exit
                            </button>
                            <button
                              onClick={() => setExitingTrade(null)}
                              className="p-2 text-gray-500 hover:text-white"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Closed Trades */}
      <div>
        <h2 className="text-white font-medium mb-3">Trade History ({closedTrades.length})</h2>
        <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2d3e] text-gray-500 text-xs">
                <th className="text-left p-3">Symbol</th>
                <th className="text-left p-3">Strategy</th>
                <th className="text-right p-3">Entry</th>
                <th className="text-right p-3">Exit</th>
                <th className="text-right p-3">Qty</th>
                <th className="text-left p-3">Exit Type</th>
                <th className="text-right p-3">P&L</th>
                <th className="text-right p-3">P&L %</th>
                <th className="text-center p-3">Plan</th>
              </tr>
            </thead>
            <tbody>
              {closedTrades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500">
                    No closed trades yet
                  </td>
                </tr>
              ) : (
                closedTrades.map(t => (
                  <tr
                    key={t.id}
                    className={`border-b border-[#2a2d3e]/50 hover:bg-[#252838] ${
                      t.pnl > 0 ? 'bg-green-500/5' : t.pnl < 0 ? 'bg-red-500/5' : ''
                    }`}
                  >
                    <td className="p-3 text-white font-medium">
                      {t.symbol}
                      {t.is_paper_trade && <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">P</span>}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${t.strategy === 'BREAKOUT' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {t.strategy}
                      </span>
                    </td>
                    <td className="p-3 text-right text-white">{t.entry_price?.toFixed(2)}</td>
                    <td className="p-3 text-right text-white">{t.exit_price?.toFixed(2)}</td>
                    <td className="p-3 text-right text-white">{t.quantity}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        t.exit_type === 'SL' ? 'bg-red-500/20 text-red-400' :
                        t.exit_type?.startsWith('TARGET') ? 'bg-green-500/20 text-green-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {t.exit_type}
                      </span>
                    </td>
                    <td className={`p-3 text-right font-medium ${t.pnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {t.pnl?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                    </td>
                    <td className={`p-3 text-right ${t.pnl_percent > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {t.pnl_percent?.toFixed(2)}%
                    </td>
                    <td className="p-3 text-center">
                      <span className={t.followed_plan ? 'text-green-400' : 'text-red-400'}>
                        {t.followed_plan ? '\u2713' : '\u2717'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
