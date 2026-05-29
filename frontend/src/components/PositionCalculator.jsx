import { useState, useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'

export default function PositionCalculator({ setup, onClose }) {
  const [capital, setCapital] = useState(500000)
  const [riskPct, setRiskPct] = useState(1.0)
  const [entryPrice, setEntryPrice] = useState(setup?.entry_price || 0)
  const [stopLoss, setStopLoss] = useState(setup?.stop_loss || 0)
  const [result, setResult] = useState(null)

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(config => {
        if (config.capital) setCapital(parseFloat(config.capital))
        if (config.risk_percent) setRiskPct(parseFloat(config.risk_percent))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (entryPrice > 0 && stopLoss > 0 && capital > 0 && riskPct > 0) {
      fetch('/api/position/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capital,
          risk_percent: riskPct,
          entry_price: entryPrice,
          stop_loss: stopLoss,
          target_1: setup?.target_1,
          target_2: setup?.target_2,
        }),
      })
        .then(r => r.json())
        .then(setResult)
        .catch(() => {})
    }
  }, [capital, riskPct, entryPrice, stopLoss])

  const warnings = []
  if (riskPct > 2) warnings.push('Risk per trade exceeds 2%')
  if (result?.capital_percent > 20) warnings.push('Capital deployed exceeds 20% of total')

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">Position Calculator</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Entry Price</label>
              <input
                type="number"
                value={entryPrice}
                onChange={e => setEntryPrice(parseFloat(e.target.value) || 0)}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Stop Loss</label>
              <input
                type="number"
                value={stopLoss}
                onChange={e => setStopLoss(parseFloat(e.target.value) || 0)}
                className="w-full"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Capital</label>
              <input
                type="number"
                value={capital}
                onChange={e => setCapital(parseFloat(e.target.value) || 0)}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Risk %</label>
              <input
                type="number"
                step="0.1"
                value={riskPct}
                onChange={e => setRiskPct(parseFloat(e.target.value) || 0)}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {result && (
          <div className="bg-[#0f1117] rounded-lg p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Quantity:</span>
                <span className="text-white ml-2 font-semibold">{result.quantity}</span>
              </div>
              <div>
                <span className="text-gray-500">Risk Amount:</span>
                <span className="text-red-400 ml-2">{result.risk_amount?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
              </div>
              <div>
                <span className="text-gray-500">Investment:</span>
                <span className="text-white ml-2">{result.amount_invested?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
              </div>
              <div>
                <span className="text-gray-500">% of Capital:</span>
                <span className="text-white ml-2">{result.capital_percent}%</span>
              </div>
              {result.risk_reward_1 && (
                <div>
                  <span className="text-gray-500">R:R T1:</span>
                  <span className="text-green-400 ml-2">1:{result.risk_reward_1}</span>
                </div>
              )}
              {result.risk_reward_2 && (
                <div>
                  <span className="text-gray-500">R:R T2:</span>
                  <span className="text-green-400 ml-2">1:{result.risk_reward_2}</span>
                </div>
              )}
              {result.target_1_pnl && (
                <div>
                  <span className="text-gray-500">T1 P&L:</span>
                  <span className="text-green-400 ml-2">+{result.target_1_pnl?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
                </div>
              )}
              {result.target_2_pnl && (
                <div>
                  <span className="text-gray-500">T2 P&L:</span>
                  <span className="text-green-400 ml-2">+{result.target_2_pnl?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-3 space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 p-2 rounded">
                <AlertTriangle size={14} />
                {w}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
