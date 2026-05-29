import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export default function TradeForm({ setup, onClose, onSubmit, existingTrade }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    symbol: setup?.symbol || existingTrade?.symbol || '',
    strategy: setup?.strategy || existingTrade?.strategy || 'BREAKOUT',
    entry_date: existingTrade?.entry_date || today,
    entry_price: setup?.entry_price || existingTrade?.entry_price || '',
    quantity: existingTrade?.quantity || '',
    stop_loss: setup?.stop_loss || existingTrade?.stop_loss || '',
    target_1: setup?.target_1 || existingTrade?.target_1 || '',
    target_2: setup?.target_2 || existingTrade?.target_2 || '',
    followed_plan: existingTrade?.followed_plan ?? true,
    notes: existingTrade?.notes || '',
    is_paper_trade: existingTrade?.is_paper_trade || false,
  })

  const [config, setConfig] = useState({ capital: 500000, risk_percent: 1.0 })

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(c => setConfig({
        capital: parseFloat(c.capital) || 500000,
        risk_percent: parseFloat(c.risk_percent) || 1.0,
      }))
      .catch(() => {})
  }, [])

  const entryPrice = parseFloat(form.entry_price) || 0
  const quantity = parseInt(form.quantity) || 0
  const capitalDeployed = entryPrice * quantity
  const stopLoss = parseFloat(form.stop_loss) || 0
  const riskAmount = Math.abs(entryPrice - stopLoss) * quantity

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      entry_price: parseFloat(form.entry_price),
      quantity: parseInt(form.quantity),
      stop_loss: parseFloat(form.stop_loss),
      target_1: parseFloat(form.target_1),
      target_2: parseFloat(form.target_2),
      capital_deployed: capitalDeployed,
      risk_amount: riskAmount,
    }

    const url = existingTrade ? `/api/trades/${existingTrade.id}` : '/api/trades'
    const method = existingTrade ? 'PUT' : 'POST'

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    onSubmit?.()
  }

  const update = (key, value) => setForm(f => ({ ...f, [key]: value }))

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">
            {existingTrade ? 'Edit Trade' : 'Log New Trade'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Symbol</label>
              <input
                required
                value={form.symbol}
                onChange={e => update('symbol', e.target.value.toUpperCase())}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Strategy</label>
              <select
                value={form.strategy}
                onChange={e => update('strategy', e.target.value)}
                className="w-full"
              >
                <option value="BREAKOUT">Breakout</option>
                <option value="REVERSAL">Reversal</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Entry Date</label>
              <input
                type="date"
                required
                value={form.entry_date}
                onChange={e => update('entry_date', e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Entry Price</label>
              <input
                type="number"
                step="0.01"
                required
                value={form.entry_price}
                onChange={e => update('entry_price', e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Quantity</label>
              <input
                type="number"
                required
                value={form.quantity}
                onChange={e => update('quantity', e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Stop Loss</label>
              <input
                type="number"
                step="0.01"
                required
                value={form.stop_loss}
                onChange={e => update('stop_loss', e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Target 1</label>
              <input
                type="number"
                step="0.01"
                required
                value={form.target_1}
                onChange={e => update('target_1', e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Target 2</label>
              <input
                type="number"
                step="0.01"
                required
                value={form.target_2}
                onChange={e => update('target_2', e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="bg-[#0f1117] rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Capital Deployed:</span>
              <span className="text-white ml-2">{capitalDeployed.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
            </div>
            <div>
              <span className="text-gray-500">Risk Amount:</span>
              <span className="text-red-400 ml-2">{riskAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              rows={2}
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={form.followed_plan}
                onChange={e => update('followed_plan', e.target.checked)}
                className="rounded"
              />
              Followed plan
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={form.is_paper_trade}
                onChange={e => update('is_paper_trade', e.target.checked)}
                className="rounded"
              />
              Paper trade
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {existingTrade ? 'Update Trade' : 'Log Trade'}
          </button>
        </form>
      </div>
    </div>
  )
}
