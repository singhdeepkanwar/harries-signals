import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

export default function EquityCurve({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] p-6 flex items-center justify-center h-64">
        <p className="text-gray-500 text-sm">No closed trades yet</p>
      </div>
    )
  }

  return (
    <div className="bg-[#1e2130] rounded-xl border border-[#2a2d3e] p-4">
      <h3 className="text-white font-medium mb-4">Equity Curve</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#8b8fa3', fontSize: 11 }}
            tickFormatter={d => d?.slice(5)}
          />
          <YAxis tick={{ fill: '#8b8fa3', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: '#1e2130',
              border: '1px solid #2a2d3e',
              borderRadius: '8px',
              color: '#e4e6ef',
              fontSize: 12,
            }}
            formatter={(value, name) => [
              `${value.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`,
              name === 'cumulative' ? 'Cumulative P&L' : 'Trade P&L',
            ]}
          />
          <ReferenceLine y={0} stroke="#4b5563" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
