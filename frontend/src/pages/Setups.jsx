import { useState, useEffect } from 'react'
import { Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import SetupCard from '../components/SetupCard'

export default function Setups() {
  const [setups, setSetups] = useState([])
  const [search, setSearch] = useState('')
  const [strategyFilter, setStrategyFilter] = useState('ALL')
  const [minScore, setMinScore] = useState(0)
  const [sortBy, setSortBy] = useState('confirmation_score')
  const [sortDir, setSortDir] = useState('desc')
  const [dateFilter, setDateFilter] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (dateFilter) {
      params.set('start_date', dateFilter)
      params.set('end_date', dateFilter)
    }
    if (strategyFilter !== 'ALL') params.set('strategy', strategyFilter)
    if (minScore > 0) params.set('min_score', minScore)

    fetch(`/api/setups/history?${params}`)
      .then(r => r.json())
      .then(setSetups)
      .catch(() => {})
  }, [dateFilter, strategyFilter, minScore])

  const filtered = setups
    .filter(s => !search || s.symbol.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortBy] ?? 0
      const bv = b[sortBy] ?? 0
      return sortDir === 'desc' ? bv - av : av - bv
    })

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return null
    return sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />
  }

  return (
    <div className="space-y-4">
      <h1 className="text-white font-semibold text-xl">All Setups</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            placeholder="Search symbol..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9"
          />
        </div>
        <select
          value={strategyFilter}
          onChange={e => setStrategyFilter(e.target.value)}
          className="min-w-[120px]"
        >
          <option value="ALL">All Strategies</option>
          <option value="BREAKOUT">Breakout</option>
          <option value="REVERSAL">Reversal</option>
        </select>
        <select
          value={minScore}
          onChange={e => setMinScore(parseInt(e.target.value))}
          className="min-w-[120px]"
        >
          <option value={0}>Any Score</option>
          <option value={2}>Score 2+</option>
          <option value={3}>Score 3+</option>
          <option value={4}>Score 4+</option>
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="min-w-[150px]"
        />
      </div>

      {/* Table */}
      <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2d3e] text-gray-500 text-xs">
                <th className="text-left p-3">Symbol</th>
                <th className="text-left p-3">Strategy</th>
                <th className="text-left p-3">Type</th>
                <th className="text-right p-3 cursor-pointer hover:text-white" onClick={() => toggleSort('entry_price')}>
                  <span className="flex items-center justify-end gap-1">Entry <SortIcon col="entry_price" /></span>
                </th>
                <th className="text-right p-3">SL</th>
                <th className="text-right p-3">T1</th>
                <th className="text-right p-3">T2</th>
                <th className="text-right p-3 cursor-pointer hover:text-white" onClick={() => toggleSort('risk_percent')}>
                  <span className="flex items-center justify-end gap-1">Risk% <SortIcon col="risk_percent" /></span>
                </th>
                <th className="text-right p-3 cursor-pointer hover:text-white" onClick={() => toggleSort('confirmation_score')}>
                  <span className="flex items-center justify-end gap-1">Score <SortIcon col="confirmation_score" /></span>
                </th>
                <th className="text-right p-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500">
                    No setups found. Run a scan or adjust filters.
                  </td>
                </tr>
              ) : (
                filtered.map(s => (
                  <>
                    <tr
                      key={s.id}
                      className="border-b border-[#2a2d3e]/50 hover:bg-[#252838] cursor-pointer"
                      onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    >
                      <td className="p-3 text-white font-medium">{s.symbol}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${s.strategy === 'BREAKOUT' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {s.strategy}
                        </span>
                      </td>
                      <td className="p-3 text-gray-400">{s.entry_type}</td>
                      <td className="p-3 text-right text-white">{s.entry_price?.toFixed(2)}</td>
                      <td className="p-3 text-right text-red-400">{s.stop_loss?.toFixed(2)}</td>
                      <td className="p-3 text-right text-green-400">{s.target_1?.toFixed(2)}</td>
                      <td className="p-3 text-right text-green-400">{s.target_2?.toFixed(2)}</td>
                      <td className="p-3 text-right text-white">{s.risk_percent?.toFixed(2)}%</td>
                      <td className="p-3 text-right">
                        <span className="flex items-center justify-end gap-0.5">
                          {Array.from({ length: s.strategy === 'BREAKOUT' ? 3 : 5 }).map((_, i) => (
                            <span key={i} className={`text-xs ${i < s.confirmation_score ? (s.strategy === 'BREAKOUT' ? 'text-green-400' : 'text-amber-400') : 'text-gray-600'}`}>
                              ●
                            </span>
                          ))}
                        </span>
                      </td>
                      <td className="p-3 text-right text-gray-400">{s.scan_date}</td>
                    </tr>
                    {expandedId === s.id && (
                      <tr key={`${s.id}-exp`}>
                        <td colSpan={10} className="p-4 bg-[#151723]">
                          <SetupCard setup={s} />
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-gray-600 text-right">
        {filtered.length} setup{filtered.length !== 1 ? 's' : ''} found
      </div>
    </div>
  )
}
