import { useState } from 'react'
import { TrendingUp, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import PositionCalculator from './PositionCalculator'
import TradeForm from './TradeForm'

export default function SetupCard({ setup, onTradeLogged }) {
  const [expanded, setExpanded] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
  const [showTradeForm, setShowTradeForm] = useState(false)

  const isBreakout = setup.strategy === 'BREAKOUT'
  const badgeColor = isBreakout ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
  const borderColor = isBreakout ? 'border-green-500/30' : 'border-amber-500/30'
  const maxScore = isBreakout ? 3 : 5

  const confirmations = []
  if (isBreakout) {
    confirmations.push({ label: 'RSI', pass: setup.rsi > 60 })
    confirmations.push({ label: 'MACD', pass: setup.macd_signal === 'BULLISH_CROSS' })
    confirmations.push({ label: 'Volume', pass: setup.volume_ratio > 1.5 })
  } else {
    confirmations.push({ label: 'Divergence', pass: setup.divergence_detected })
    confirmations.push({ label: 'MACD', pass: true })
    confirmations.push({ label: 'EMA Hold', pass: true })
    confirmations.push({ label: 'Double Bottom', pass: true })
    confirmations.push({ label: 'Vol Trend', pass: true })
  }

  return (
    <>
      <div className={`bg-[#1e2130] rounded-xl border ${borderColor} p-4 hover:border-opacity-60 transition-all`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white font-semibold text-lg">{setup.symbol}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${badgeColor}`}>
                {setup.strategy}
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">
                {setup.entry_type}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: maxScore }).map((_, i) => (
              <span key={i} className={`text-sm ${i < setup.confirmation_score ? (isBreakout ? 'text-green-400' : 'text-amber-400') : 'text-gray-600'}`}>
                ●
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-3 text-sm">
          <div>
            <div className="text-gray-500 text-xs">Entry</div>
            <div className="text-white font-medium">{setup.entry_price?.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Stop Loss</div>
            <div className="text-red-400 font-medium">{setup.stop_loss?.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Target 1</div>
            <div className="text-green-400 font-medium">{setup.target_1?.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Target 2</div>
            <div className="text-green-400 font-medium">{setup.target_2?.toFixed(2)}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {confirmations.map(({ label, pass }) => (
            <span key={label} className={`text-xs px-2 py-0.5 rounded ${pass ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-500'}`}>
              {label} {pass ? '\u2713' : '\u2717'}
            </span>
          ))}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-3"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Less' : 'More'} details
        </button>

        {expanded && (
          <div className="grid grid-cols-3 gap-2 text-xs mb-3 bg-[#0f1117] rounded-lg p-3">
            <div><span className="text-gray-500">Risk:</span> <span className="text-white">{setup.risk_percent?.toFixed(2)}%</span></div>
            <div><span className="text-gray-500">RSI:</span> <span className="text-white">{setup.rsi?.toFixed(1)}</span></div>
            <div><span className="text-gray-500">Vol Ratio:</span> <span className="text-white">{setup.volume_ratio?.toFixed(2)}x</span></div>
            {isBreakout && (
              <>
                <div><span className="text-gray-500">MACD:</span> <span className="text-white">{setup.macd_signal}</span></div>
                <div><span className="text-gray-500">Consol Days:</span> <span className="text-white">{setup.consolidation_days}</span></div>
              </>
            )}
            {!isBreakout && (
              <>
                <div><span className="text-gray-500">CHoCH Level:</span> <span className="text-white">{setup.choch_level?.toFixed(2)}</span></div>
                <div><span className="text-gray-500">Downtrend:</span> <span className="text-white">{setup.downtrend_duration_days}d</span></div>
              </>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setShowCalculator(true)}
            className="flex-1 py-2 rounded-lg bg-blue-600/20 text-blue-400 text-sm hover:bg-blue-600/30 transition-colors"
          >
            Calculate Position
          </button>
          <button
            onClick={() => setShowTradeForm(true)}
            className="flex-1 py-2 rounded-lg bg-green-600/20 text-green-400 text-sm hover:bg-green-600/30 transition-colors"
          >
            Log Trade
          </button>
        </div>
      </div>

      {showCalculator && (
        <PositionCalculator setup={setup} onClose={() => setShowCalculator(false)} />
      )}
      {showTradeForm && (
        <TradeForm
          setup={setup}
          onClose={() => setShowTradeForm(false)}
          onSubmit={() => {
            setShowTradeForm(false)
            onTradeLogged?.()
          }}
        />
      )}
    </>
  )
}
