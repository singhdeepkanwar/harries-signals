import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Activity, BarChart2, Zap, Clock } from "lucide-react";

const StatCard = ({ label, value, sub, color = "text-white" }) => (
  <div className="bg-slate-900 rounded-lg p-3">
    <div className="text-slate-400 text-xs mb-1">{label}</div>
    <div className={`text-xl font-bold ${color}`}>{value}</div>
    {sub && <div className="text-slate-500 text-xs mt-0.5">{sub}</div>}
  </div>
);

const AlgoCard = ({ title, description, icon, tag, stats, status, color }) => (
  <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${color}`}>{icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-white font-bold text-lg">{title}</h3>
            <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full">{tag}</span>
          </div>
          <p className="text-slate-400 text-sm mt-0.5">{description}</p>
        </div>
      </div>
      <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${
        status === "LIVE" ? "bg-emerald-500/20 text-emerald-400" :
        status === "SCHEDULED" ? "bg-yellow-500/20 text-yellow-400" :
        "bg-slate-700 text-slate-400"
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${
          status === "LIVE" ? "bg-emerald-400 animate-pulse" :
          status === "SCHEDULED" ? "bg-yellow-400" : "bg-slate-500"
        }`} />
        {status}
      </span>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => <StatCard key={s.label} {...s} />)}
    </div>
  </div>
);

export default function Algorithms() {
  const [intraday, setIntraday] = useState(null);
  const [swing, setSwing] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch("/api/intraday/today").then(r => r.json()).then(setIntraday).catch(() => {});
    fetch("/api/setups/today").then(r => r.json()).then(setSwing).catch(() => {});
    fetch("/api/intraday/history?days=7").then(r => r.json()).then(d => setHistory(d.history || [])).catch(() => {});
  }, []);

  const now = new Date();
  const isMarketHours = now.getHours() >= 9 && now.getHours() < 15;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Algorithms</h1>
        <p className="text-slate-400 text-sm mt-0.5">All active trading strategies and their daily performance</p>
      </div>

      <div className="space-y-4">
        {/* Intraday Screener */}
        <AlgoCard
          title="Intraday Open=Low / Open=High"
          description="Scans Nifty 200 at 9:20 AM. BUY when Open=Low breaks 5-min high. SELL when Open=High breaks 5-min low."
          icon={<Zap size={20} className="text-yellow-400" />}
          tag="Intraday"
          color="bg-yellow-500/10"
          status={isMarketHours ? "LIVE" : "SCHEDULED"}
          stats={[
            { label: "Scan Time", value: intraday?.scan_time || "—", sub: "9:20 AM daily" },
            { label: "BUY Candidates", value: intraday?.buy_count ?? "—", color: "text-emerald-400", sub: "Open = Low" },
            { label: "SELL Candidates", value: intraday?.sell_count ?? "—", color: "text-red-400", sub: "Open = High" },
            { label: "Alerts Today", value: intraday?.alerts_fired ?? "—", color: "text-yellow-400", sub: "Triggered" },
          ]}
        />

        {/* Swing Breakout */}
        <AlgoCard
          title="Swing Breakout Scanner"
          description="Identifies stocks consolidating near 52-week highs with volume confirmation. Entry on breakout or retest."
          icon={<TrendingUp size={20} className="text-emerald-400" />}
          tag="Swing"
          color="bg-emerald-500/10"
          status="SCHEDULED"
          stats={[
            { label: "Setups Today", value: swing?.breakout?.length ?? "—", color: "text-emerald-400" },
            { label: "Universe", value: "Nifty 500", sub: "172 stocks" },
            { label: "Scan Schedule", value: "Nightly", sub: "Post market" },
            { label: "Avg Score", value: swing?.breakout?.length
                ? (swing.breakout.reduce((a, b) => a + (b.confirmation_score || 0), 0) / swing.breakout.length).toFixed(1)
                : "—", sub: "/ 4.0" },
          ]}
        />

        {/* Swing Reversal */}
        <AlgoCard
          title="Swing Reversal Scanner"
          description="Finds stocks in extended downtrends showing Change of Character (CHoCH) with RSI divergence and volume spike."
          icon={<TrendingDown size={20} className="text-blue-400" />}
          tag="Swing"
          color="bg-blue-500/10"
          status="SCHEDULED"
          stats={[
            { label: "Setups Today", value: swing?.reversal?.length ?? "—", color: "text-blue-400" },
            { label: "Universe", value: "Nifty 500", sub: "172 stocks" },
            { label: "Scan Schedule", value: "Nightly", sub: "Post market" },
            { label: "Avg Score", value: swing?.reversal?.length
                ? (swing.reversal.reduce((a, b) => a + (b.confirmation_score || 0), 0) / swing.reversal.length).toFixed(1)
                : "—", sub: "/ 4.0" },
          ]}
        />
      </div>

      {/* 7-day history table */}
      {history.length > 0 && (
        <div>
          <h2 className="text-white font-semibold text-lg mb-3 flex items-center gap-2">
            <BarChart2 size={18} /> Last 7 Days — Intraday Screener
          </h2>
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs">
                <tr>
                  {["Date", "BUY Candidates", "SELL Candidates", "Triggered"].map(h => (
                    <th key={h} className="px-5 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {history.map((row) => (
                  <tr key={row.date} className="hover:bg-slate-700/40 transition-colors">
                    <td className="px-5 py-3 text-slate-300">{row.date}</td>
                    <td className="px-5 py-3 text-emerald-400 font-medium">{row.buy}</td>
                    <td className="px-5 py-3 text-red-400 font-medium">{row.sell}</td>
                    <td className="px-5 py-3 text-yellow-400 font-medium">{row.triggered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
