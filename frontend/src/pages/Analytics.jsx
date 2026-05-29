import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { TrendingUp, Target, Award, Percent, Flame, ThumbsUp } from 'lucide-react'
import EquityCurve from '../components/EquityCurve'

export default function Analytics() {
  const [summary, setSummary] = useState(null)
  const [equity, setEquity] = useState([])
  const [monthly, setMonthly] = useState([])
  const [byStrategy, setByStrategy] = useState(null)
  const [trades, setTrades] = useState([])

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics/summary').then(r => r.json()),
      fetch('/api/analytics/equity').then(r => r.json()),
      fetch('/api/analytics/monthly').then(r => r.json()),
      fetch('/api/analytics/by-strategy').then(r => r.json()),
      fetch('/api/trades').then(r => r.json()),
    ]).then(([s, e, m, bs, t]) => {
      setSummary(s)
      setEquity(e)
      setMonthly(m)
      setByStrategy(bs)
      setTrades(t)
    })
  }, [])

  if (!summary) return null

  const strategyData = byStrategy ? [
    { name: 'Breakout', wins: byStrategy.BREAKOUT?.wins || 0, losses: byStrategy.BREAKOUT?.losses || 0, pnl: byStrategy.BREAKOUT?.total_pnl || 0 },
    { name: 'Reversal', wins: byStrategy.REVERSAL?.wins || 0, losses: byStrategy.REVERSAL?.losses || 0, pnl: byStrategy.REVERSAL?.total_pnl || 0 },
  ] : []

  // P&L distribution buckets
  const closedTrades = trades.filter(t => t.pnl != null)
  const pnlBuckets = {}
  closedTrades.forEach(t => {
    const bucket = Math.floor(t.pnl_percent / 2) * 2
    const key = `${bucket}% to ${bucket + 2}%`
    pnlBuckets[key] = (pnlBuckets[key] || 0) + 1
  })
  const distribution = Object.entries(pnlBuckets)
    .map(([range, count]) => ({ range, count, value: parseFloat(range) }))
    .sort((a, b) => a.value - b.value)

  // Score vs outcome
  const scoreOutcome = closedTrades
    .filter(t => t.pnl != null)
    .map(t => ({
      score: 3, // Would need to join with setup data
      pnl: t.pnl_percent,
      symbol: t.symbol,
    }))

  const stats = [
    { label: 'Total Trades', value: summary.total_trades, icon: Target, color: 'text-blue-400' },
    { label: 'Win Rate', value: `${summary.win_rate}%`, icon: Percent, color: 'text-green-400' },
    { label: 'Avg R:R', value: summary.avg_rr, icon: TrendingUp, color: 'text-blue-400' },
    { label: 'Profit Factor', value: summary.profit_factor, icon: Award, color: 'text-amber-400' },
    { label: 'Best Trade', value: `${summary.best_trade?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`, icon: TrendingUp, color: 'text-green-400' },
    { label: 'Worst Trade', value: `${summary.worst_trade?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`, icon: TrendingUp, color: 'text-red-400' },
    { label: 'Streak', value: summary.current_streak > 0 ? `${summary.current_streak}W` : `${Math.abs(summary.current_streak)}L`, icon: Flame, color: summary.current_streak >= 0 ? 'text-green-400' : 'text-red-400' },
    { label: 'Plan Followed', value: `${summary.plan_followed_pct}%`, icon: ThumbsUp, color: 'text-blue-400' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-white font-semibold text-xl">Analytics</h1>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={16} className={color} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <div className="text-xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Total P&L */}
      <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] p-6 text-center">
        <p className="text-gray-500 text-sm mb-1">Total P&L</p>
        <p className={`text-3xl font-bold ${summary.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {summary.total_pnl?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
        </p>
      </div>

      {/* Equity Curve */}
      <EquityCurve data={equity} />

      {/* Strategy Comparison + Monthly P&L */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] p-4">
          <h3 className="text-white font-medium mb-4">Win/Loss by Strategy</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={strategyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
              <XAxis dataKey="name" tick={{ fill: '#8b8fa3', fontSize: 12 }} />
              <YAxis tick={{ fill: '#8b8fa3', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1e2130', border: '1px solid #2a2d3e', borderRadius: '8px', color: '#e4e6ef', fontSize: 12 }}
              />
              <Bar dataKey="wins" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="losses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] p-4">
          <h3 className="text-white font-medium mb-4">Monthly P&L</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
              <XAxis dataKey="month" tick={{ fill: '#8b8fa3', fontSize: 11 }} tickFormatter={m => m?.slice(5)} />
              <YAxis tick={{ fill: '#8b8fa3', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1e2130', border: '1px solid #2a2d3e', borderRadius: '8px', color: '#e4e6ef', fontSize: 12 }}
                formatter={v => [`${v.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`, 'P&L']}
              />
              <ReferenceLine y={0} stroke="#4b5563" />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {monthly.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* P&L Distribution */}
      {distribution.length > 0 && (
        <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] p-4">
          <h3 className="text-white font-medium mb-4">P&L Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
              <XAxis dataKey="range" tick={{ fill: '#8b8fa3', fontSize: 10 }} />
              <YAxis tick={{ fill: '#8b8fa3', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1e2130', border: '1px solid #2a2d3e', borderRadius: '8px', color: '#e4e6ef', fontSize: 12 }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                {distribution.map((entry, i) => (
                  <Cell key={i} fill={entry.value >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
