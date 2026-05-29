import { useState, useEffect } from 'react'
import { Save, Send, Check, X, Loader } from 'lucide-react'

export default function Settings() {
  const [config, setConfig] = useState({
    capital: '500000',
    risk_percent: '1.0',
    max_trades_per_month: '10',
    telegram_token: '',
    telegram_chat_id: '',
    index_filter: 'NIFTY500',
    paper_trade_mode: 'false',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testingTg, setTestingTg] = useState(false)
  const [tgResult, setTgResult] = useState(null)

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(c => setConfig(prev => ({ ...prev, ...c })))
      .catch(() => {})
  }, [])

  const update = (key, value) => setConfig(c => ({ ...c, [key]: value }))

  const save = async () => {
    setSaving(true)
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configs: config }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const testTelegram = async () => {
    setTestingTg(true)
    setTgResult(null)
    try {
      const r = await fetch('/api/config/test-telegram', { method: 'POST' })
      const data = await r.json()
      setTgResult(data.success ? 'success' : 'failed')
    } catch {
      setTgResult('failed')
    }
    setTestingTg(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-white font-semibold text-xl">Settings</h1>

      {/* Trading Configuration */}
      <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] p-6 space-y-4">
        <h2 className="text-white font-medium">Trading Configuration</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-500 block mb-1">Total Trading Capital</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">INR</span>
              <input
                type="number"
                value={config.capital}
                onChange={e => update('capital', e.target.value)}
                className="w-full pl-12"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1">Risk Per Trade (%)</label>
            <input
              type="number"
              step="0.1"
              value={config.risk_percent}
              onChange={e => update('risk_percent', e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-500 block mb-1">Max Trades Per Month</label>
            <input
              type="number"
              value={config.max_trades_per_month}
              onChange={e => update('max_trades_per_month', e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1">Index Filter</label>
            <select
              value={config.index_filter}
              onChange={e => update('index_filter', e.target.value)}
              className="w-full"
            >
              <option value="NIFTY500">Nifty 500</option>
              <option value="NIFTY200">Nifty 200</option>
              <option value="NIFTY50">Nifty 50</option>
            </select>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`w-10 h-5 rounded-full p-0.5 transition-colors ${
                config.paper_trade_mode === 'true' ? 'bg-amber-500' : 'bg-gray-600'
              }`}
              onClick={() => update('paper_trade_mode', config.paper_trade_mode === 'true' ? 'false' : 'true')}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                config.paper_trade_mode === 'true' ? 'translate-x-5' : ''
              }`} />
            </div>
            <span className="text-sm text-gray-400">Paper Trade Mode</span>
          </label>
          {config.paper_trade_mode === 'true' && (
            <p className="text-xs text-amber-400 mt-1">All trades will be tagged as paper trades</p>
          )}
        </div>
      </div>

      {/* Telegram Configuration */}
      <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] p-6 space-y-4">
        <h2 className="text-white font-medium">Telegram Alerts (Optional)</h2>

        <div>
          <label className="text-sm text-gray-500 block mb-1">Bot Token</label>
          <input
            type="password"
            value={config.telegram_token}
            onChange={e => update('telegram_token', e.target.value)}
            placeholder="Enter Telegram Bot Token"
            className="w-full"
          />
        </div>

        <div>
          <label className="text-sm text-gray-500 block mb-1">Chat ID</label>
          <input
            type="text"
            value={config.telegram_chat_id}
            onChange={e => update('telegram_chat_id', e.target.value)}
            placeholder="Enter Telegram Chat ID"
            className="w-full"
          />
        </div>

        <button
          onClick={testTelegram}
          disabled={testingTg || !config.telegram_token || !config.telegram_chat_id}
          className="flex items-center gap-2 px-4 py-2 bg-[#0f1117] border border-[#2a2d3e] text-gray-400 rounded-lg text-sm hover:text-white hover:border-blue-500 disabled:opacity-50 transition-colors"
        >
          {testingTg ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
          Test Connection
        </button>

        {tgResult === 'success' && (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <Check size={14} /> Test message sent successfully!
          </div>
        )}
        {tgResult === 'failed' && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <X size={14} /> Test failed. Check your token and chat ID.
          </div>
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
      >
        {saving ? (
          <Loader size={16} className="animate-spin" />
        ) : saved ? (
          <Check size={16} />
        ) : (
          <Save size={16} />
        )}
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}
