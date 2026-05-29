import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Clock, Zap } from "lucide-react";

const Badge = ({ text, color }) => {
  const colors = {
    BUY: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    SELL: "bg-red-500/20 text-red-400 border border-red-500/30",
    WATCHING: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
    TRIGGERED: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${colors[text] || "bg-slate-700 text-slate-300"}`}>
      {text}
    </span>
  );
};

const fmt = (n) => {
  if (!n) return "—";
  if (n >= 1e7) return (n / 1e7).toFixed(1) + "Cr";
  if (n >= 1e5) return (n / 1e5).toFixed(1) + "L";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n;
};

export default function Intraday() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = async () => {
    try {
      const res = await fetch("/api/intraday/today");
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date().toLocaleTimeString("en-IN"));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="animate-spin text-slate-400" size={32} />
    </div>
  );

  const noData = !data || data.total_scanned === 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Intraday Screener</h1>
          <p className="text-slate-400 text-sm mt-0.5">Open = Low (BUY) · Open = High (SELL) · First 5-min candle</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-slate-500 text-xs flex items-center gap-1">
              <Clock size={12} /> {lastRefresh}
            </span>
          )}
          <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Scan Time", value: data.scan_time || "—", icon: <Clock size={18} /> },
            { label: "BUY Candidates", value: data.buy_count ?? 0, icon: <TrendingUp size={18} className="text-emerald-400" /> },
            { label: "SELL Candidates", value: data.sell_count ?? 0, icon: <TrendingDown size={18} className="text-red-400" /> },
            { label: "Alerts Fired", value: data.alerts_fired ?? 0, icon: <Zap size={18} className="text-yellow-400" /> },
          ].map((c) => (
            <div key={c.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">{c.icon}{c.label}</div>
              <div className="text-2xl font-bold text-white">{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {noData ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center text-slate-400">
          No scan data for today yet. Screener runs at 9:20 AM IST on weekdays.
        </div>
      ) : (
        <>
          {/* BUY Table */}
          {data.buy_candidates?.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 text-emerald-400 font-semibold text-lg mb-3">
                <TrendingUp size={20} /> Open = Low — BUY candidates ({data.buy_candidates.length})
              </h2>
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900 text-slate-400 text-xs">
                    <tr>
                      {["Symbol","Open","High (Trigger)","Low","Range%","Volume","Status"].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {data.buy_candidates.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-700/40 transition-colors">
                        <td className="px-4 py-3 font-bold text-white">{s.symbol.replace(".NS","")}</td>
                        <td className="px-4 py-3 text-slate-300">₹{s.open?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-emerald-400 font-medium">₹{s.high?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-300">₹{s.low?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-300">{s.range_pct}%</td>
                        <td className="px-4 py-3 text-slate-300">{fmt(s.volume)}</td>
                        <td className="px-4 py-3"><Badge text={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SELL Table */}
          {data.sell_candidates?.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 text-red-400 font-semibold text-lg mb-3">
                <TrendingDown size={20} /> Open = High — SELL candidates ({data.sell_candidates.length})
              </h2>
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900 text-slate-400 text-xs">
                    <tr>
                      {["Symbol","Open","High","Low (Trigger)","Range%","Volume","Status"].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {data.sell_candidates.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-700/40 transition-colors">
                        <td className="px-4 py-3 font-bold text-white">{s.symbol.replace(".NS","")}</td>
                        <td className="px-4 py-3 text-slate-300">₹{s.open?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-300">₹{s.high?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-red-400 font-medium">₹{s.low?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-300">{s.range_pct}%</td>
                        <td className="px-4 py-3 text-slate-300">{fmt(s.volume)}</td>
                        <td className="px-4 py-3"><Badge text={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Alerts fired today */}
          {data.alerts?.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 text-yellow-400 font-semibold text-lg mb-3">
                <Zap size={20} /> Alerts Fired Today ({data.alerts.length})
              </h2>
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900 text-slate-400 text-xs">
                    <tr>
                      {["Time","Symbol","Signal","CMP","Move%","Trigger","Volume","VWAP"].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {data.alerts.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-700/40 transition-colors">
                        <td className="px-4 py-3 text-slate-400 text-xs">{a.time}</td>
                        <td className="px-4 py-3 font-bold text-white">{a.symbol.replace(".NS","")}</td>
                        <td className="px-4 py-3"><Badge text={a.direction} /></td>
                        <td className="px-4 py-3 text-white">₹{a.cmp?.toFixed(2)}</td>
                        <td className={`px-4 py-3 font-medium ${a.pct_move >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {a.pct_move >= 0 ? "+" : ""}{a.pct_move?.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-slate-300">₹{a.trigger?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-300">{fmt(a.volume)}</td>
                        <td className="px-4 py-3 text-slate-300">{a.vwap ? `₹${a.vwap.toFixed(2)}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
