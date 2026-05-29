import { useEffect, useRef, useState } from "react";
import { Send, MessageCircle, CheckCircle, XCircle, RefreshCw } from "lucide-react";

export default function TelegramChat() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null); // {type: "success"|"error", msg: str}
  const bottomRef = useRef(null);

  const loadMessages = async () => {
    try {
      const res = await fetch("/api/telegram/messages?limit=30");
      const json = await res.json();
      setMessages(json.messages || []);
    } catch (e) {}
  };

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/telegram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        setStatus({ type: "success", msg: "Sent to group!" });
        setText("");
        await loadMessages();
      } else {
        const err = await res.json();
        setStatus({ type: "error", msg: err.detail || "Send failed" });
      }
    } catch (e) {
      setStatus({ type: "error", msg: "Network error" });
    } finally {
      setSending(false);
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="p-6 flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-xl">
            <MessageCircle size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Telegram</h1>
            <p className="text-slate-400 text-xs">Harrie, Harries Signals and REDDY Hyd · @Harriestradebot</p>
          </div>
          <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
          </span>
        </div>
        <button onClick={loadMessages} className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
        {messages.length === 0 ? (
          <div className="text-center text-slate-500 py-12">No messages sent yet</div>
        ) : (
          [...messages].reverse().map((m) => (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[70%] bg-blue-600 rounded-2xl rounded-br-sm px-4 py-2.5 space-y-0.5">
                <p className="text-white text-sm whitespace-pre-wrap">{m.text}</p>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-blue-200 text-xs">{m.sent_at}</span>
                  {m.status === "sent"
                    ? <CheckCircle size={12} className="text-blue-200" />
                    : <XCircle size={12} className="text-red-300" />}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Status banner */}
      {status && (
        <div className={`mb-2 px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
          status.type === "success"
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            : "bg-red-500/20 text-red-400 border border-red-500/30"
        }`}>
          {status.type === "success" ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {status.msg}
        </div>
      )}

      {/* Composer */}
      <div className="flex items-end gap-3 bg-slate-800 border border-slate-700 rounded-2xl p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message... (Enter to send)"
          rows={2}
          className="flex-1 bg-transparent text-white text-sm resize-none outline-none placeholder-slate-500"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors flex-shrink-0"
        >
          {sending ? <RefreshCw size={18} className="text-white animate-spin" /> : <Send size={18} className="text-white" />}
        </button>
      </div>
    </div>
  );
}
