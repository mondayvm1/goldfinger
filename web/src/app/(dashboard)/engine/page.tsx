"use client";

import { useState, useEffect, useCallback } from "react";

interface EngineSettings {
  mode: "live" | "paper";
  paper_starting_balance: number;
  min_confidence: number;
  min_edge: number;
  max_price: number;
  min_reward_risk: number;
  kelly_btc: number;
  kelly_eth: number;
  max_contracts_per_market: number;
  daily_loss_limit: number;
  interval: number;
  enabled_assets: string[];
}

interface EngineStatus {
  running: boolean;
  cycle?: number;
  trades_fired?: number;
  error?: string;
}

interface PaperStats {
  balance: number;
  starting_balance: number;
  realized_pnl: number;
  open_positions: number;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  recent_trades: PaperTrade[];
}

interface PaperTrade {
  id: string;
  ticker: string;
  side: string;
  price: number;
  count: number;
  cost: number;
  status: string;
  pnl: number | null;
  timestamp: string;
  confidence: number;
  edge: number;
}

const DEFAULT_SETTINGS: EngineSettings = {
  mode: "paper",
  paper_starting_balance: 100,
  min_confidence: 55,
  min_edge: 0.05,
  max_price: 0.35,
  min_reward_risk: 2.0,
  kelly_btc: 0.20,
  kelly_eth: 0.10,
  max_contracts_per_market: 10,
  daily_loss_limit: 20.0,
  interval: 45,
  enabled_assets: ["BTC", "ETH"],
};

function Slider({
  label, value, min, max, step, format, onChange,
}: {
  label: string; value: number; min: number; max: number;
  step: number; format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium text-text-secondary">{label}</label>
        <span className="text-sm font-mono text-gold font-bold">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-gold bg-bg-primary"
      />
      <div className="flex justify-between text-xs text-text-secondary mt-1">
        <span>{format(min)}</span><span>{format(max)}</span>
      </div>
    </div>
  );
}

export default function EnginePage() {
  const [settings, setSettings] = useState<EngineSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<EngineStatus>({ running: false });
  const [paper, setPaper] = useState<PaperStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/engine/autopilot");
      setStatus(await res.json());
    } catch {
      setStatus({ running: false, error: "Engine unreachable" });
    }
  }, []);

  const fetchPaper = useCallback(() => {
    fetch("/api/engine/paper")
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => { if (data) setPaper(data); })
      .catch(() => { /* silent */ });
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/engine/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch { /* use defaults */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchStatus();
    fetchPaper();
    const iv = setInterval(() => { fetchStatus(); fetchPaper(); }, 10000);
    return () => clearInterval(iv);
  }, [fetchSettings, fetchStatus, fetchPaper]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/engine/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) showMsg("success", "Settings saved — takes effect on next cycle");
      else showMsg("error", (await res.json()).error || "Failed to save");
    } catch { showMsg("error", "Engine unreachable"); }
    finally { setSaving(false); }
  };

  const autopilotAction = async (action: "start" | "stop" | "kill") => {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/engine/autopilot?action=${action}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) { showMsg("success", data.message || `${action} sent`); setTimeout(fetchStatus, 1500); }
      else showMsg("error", data.error || `${action} failed`);
    } catch { showMsg("error", "Engine unreachable"); }
    finally { setActionLoading(null); setShowKillConfirm(false); }
  };

  const resetPaper = async () => {
    setActionLoading("reset");
    try {
      const res = await fetch("/api/engine/paper?action=reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starting_balance: settings.paper_starting_balance }),
      });
      const data = await res.json();
      if (res.ok) { showMsg("success", data.message || "Paper account reset"); fetchPaper(); }
      else showMsg("error", data.error || "Reset failed");
    } catch { showMsg("error", "Engine unreachable"); }
    finally { setActionLoading(null); setShowResetConfirm(false); }
  };

  const toggleAsset = (asset: string) => {
    setSettings((prev) => ({
      ...prev,
      enabled_assets: prev.enabled_assets.includes(asset)
        ? prev.enabled_assets.filter((a) => a !== asset)
        : [...prev.enabled_assets, asset],
    }));
  };

  const isPaper = settings.mode === "paper";

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-bg-card rounded-xl animate-pulse" />
        <div className="glass-card p-6 h-40 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">⚡ Engine Control</h1>
        <p className="text-text-secondary text-sm mt-1">
          Manage the autopilot and tune risk parameters in real-time.
        </p>
      </div>

      {/* Toast */}
      {message && (
        <div className={`p-4 rounded-xl text-sm flex items-center justify-between ${
          message.type === "success"
            ? "bg-green/10 border border-green/20 text-green"
            : "bg-red/10 border border-red/20 text-red"
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-4 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Mode Toggle — PAPER vs LIVE */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">Trading Mode</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setSettings((p) => ({ ...p, mode: "paper" }))}
            className={`flex-1 py-4 rounded-xl font-bold text-sm border transition-all ${
              isPaper
                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
                : "bg-bg-card text-text-secondary border-border hover:border-yellow-500/30"
            }`}
          >
            📄 PAPER
            <div className="text-xs font-normal mt-1 opacity-70">Simulate with real prices</div>
          </button>
          <button
            onClick={() => setSettings((p) => ({ ...p, mode: "live" }))}
            className={`flex-1 py-4 rounded-xl font-bold text-sm border transition-all ${
              !isPaper
                ? "bg-green/20 text-green border-green/40"
                : "bg-bg-card text-text-secondary border-border hover:border-green/30"
            }`}
          >
            🔴 LIVE
            <div className="text-xs font-normal mt-1 opacity-70">Real money on Kalshi</div>
          </button>
        </div>
        {!isPaper && (
          <p className="mt-3 text-xs text-red bg-red/5 border border-red/20 rounded-lg px-3 py-2">
            ⚠ LIVE mode places real orders. Make sure your settings are correct before starting.
          </p>
        )}
      </div>

      {/* Paper Stats — only show when in paper mode */}
      {isPaper && paper && (
        <div className="glass-card p-6 border border-yellow-500/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-yellow-400">📄 Paper Account</h2>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-xs text-text-secondary hover:text-red px-3 py-1.5 rounded-lg border border-border hover:border-red/30 transition-colors"
            >
              Reset
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {[
              { label: "Balance", value: `$${paper.balance.toFixed(2)}` },
              {
                label: "P&L",
                value: `${paper.realized_pnl >= 0 ? "+" : ""}$${paper.realized_pnl.toFixed(2)}`,
                color: paper.realized_pnl >= 0 ? "text-green" : "text-red",
              },
              { label: "Win Rate", value: `${paper.win_rate}%` },
              { label: "Open", value: `${paper.open_positions}` },
            ].map((stat) => (
              <div key={stat.label} className="bg-bg-primary rounded-xl p-3 text-center">
                <div className={`text-lg font-bold font-mono ${stat.color || "text-text-primary"}`}>
                  {stat.value}
                </div>
                <div className="text-xs text-text-secondary mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="text-xs text-text-secondary mb-2">
            {paper.wins}W / {paper.losses}L · {paper.total_trades} total trades
            · Started at ${paper.starting_balance.toFixed(2)}
          </div>

          {/* Recent paper trades */}
          {paper.recent_trades.length > 0 && (
            <div className="space-y-1 mt-3 max-h-40 overflow-y-auto">
              {paper.recent_trades.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-xs bg-bg-card rounded-lg px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${t.side === "yes" ? "text-green" : "text-red"}`}>
                      {t.side.toUpperCase()}
                    </span>
                    <span className="text-text-secondary truncate max-w-[140px]">{t.ticker}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-text-secondary">${t.price.toFixed(2)} × {t.count}</span>
                    {t.status === "settled" && t.pnl !== null ? (
                      <span className={`font-mono font-bold ${t.pnl >= 0 ? "text-green" : "text-red"}`}>
                        {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                      </span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reset Paper Confirm */}
      {showResetConfirm && (
        <div className="glass-card p-6 border border-yellow-500/30 bg-yellow-500/5">
          <h3 className="font-semibold text-yellow-400 mb-2">Reset Paper Account?</h3>
          <p className="text-sm text-text-secondary mb-4">
            This will archive current paper trades and reset balance to ${settings.paper_starting_balance.toFixed(2)}.
          </p>
          <div className="flex gap-3">
            <button onClick={resetPaper} className="px-5 py-2 rounded-xl bg-yellow-500 text-black font-bold text-sm hover:opacity-90">
              {actionLoading === "reset" ? "Resetting..." : "Yes, Reset"}
            </button>
            <button onClick={() => setShowResetConfirm(false)} className="px-5 py-2 rounded-xl bg-bg-card border border-border text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Autopilot Status + Controls */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${status.running ? "bg-green pulse-gold" : "bg-text-secondary"}`} />
            <h2 className="text-lg font-semibold">
              Autopilot {status.running ? "Running" : "Stopped"}
              {status.running && (
                <span className={`ml-2 text-xs font-mono px-2 py-0.5 rounded ${
                  isPaper ? "bg-yellow-500/20 text-yellow-400" : "bg-green/20 text-green"
                }`}>
                  {isPaper ? "PAPER" : "LIVE"}
                </span>
              )}
            </h2>
          </div>
          {status.running && status.cycle !== undefined && (
            <span className="text-xs text-text-secondary font-mono">
              cycle #{status.cycle} · {status.trades_fired ?? 0} trades
            </span>
          )}
        </div>

        {status.error && !status.running && (
          <div className="mb-4 p-3 rounded-xl bg-red/5 border border-red/20 text-red text-sm">{status.error}</div>
        )}

        <div className="flex gap-3 flex-wrap">
          <button onClick={() => autopilotAction("start")}
            disabled={status.running || actionLoading !== null}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-gold to-gold-dark text-black font-bold text-sm hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed">
            {actionLoading === "start" ? "Starting..." : "▶ Start"}
          </button>
          <button onClick={() => autopilotAction("stop")}
            disabled={!status.running || actionLoading !== null}
            className="px-6 py-2.5 rounded-xl bg-bg-card border border-border text-sm font-medium hover:border-gold/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {actionLoading === "stop" ? "Stopping..." : "⏸ Stop"}
          </button>
          <button onClick={() => setShowKillConfirm(true)}
            disabled={actionLoading !== null}
            className="px-6 py-2.5 rounded-xl bg-red/10 border border-red/20 text-red text-sm font-medium hover:bg-red/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {actionLoading === "kill" ? "Killing..." : "☠ Kill + Cancel All"}
          </button>
        </div>
      </div>

      {/* Kill Confirm */}
      {showKillConfirm && (
        <div className="glass-card p-6 border border-red/30 bg-red/5">
          <h3 className="font-semibold text-red mb-2">Confirm Kill</h3>
          <p className="text-sm text-text-secondary mb-4">
            Stop the autopilot and cancel all open orders on Kalshi. Are you sure?
          </p>
          <div className="flex gap-3">
            <button onClick={() => autopilotAction("kill")}
              className="px-5 py-2 rounded-xl bg-red text-white font-bold text-sm hover:opacity-90">
              {actionLoading === "kill" ? "Killing..." : "Yes, Kill It"}
            </button>
            <button onClick={() => setShowKillConfirm(false)}
              className="px-5 py-2 rounded-xl bg-bg-card border border-border text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Risk Parameters */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-6">Risk Parameters</h2>

        {/* Paper starting balance — only show in paper mode */}
        {isPaper && (
          <div className="mb-6 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Paper Starting Balance ($)
            </label>
            <input type="number" min={10} step={10} value={settings.paper_starting_balance}
              onChange={(e) => setSettings((p) => ({ ...p, paper_starting_balance: parseFloat(e.target.value) || 100 }))}
              className="w-40 px-3 py-2 rounded-xl bg-bg-primary border border-border text-text-primary font-mono text-sm focus:border-gold focus:outline-none"
            />
            <p className="text-xs text-text-secondary mt-1">Used when you reset the paper account</p>
          </div>
        )}

        {/* Asset toggles */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-secondary mb-3">Active Assets</label>
          <div className="flex gap-2">
            {["BTC", "ETH", "SOL"].map((asset) => {
              const active = settings.enabled_assets.includes(asset);
              return (
                <button key={asset} onClick={() => toggleAsset(asset)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                    active ? "bg-gold/20 text-gold border-gold/40" : "bg-bg-card text-text-secondary border-border hover:border-gold/20"
                  }`}>
                  {asset}
                </button>
              );
            })}
          </div>
          {settings.enabled_assets.includes("SOL") && (
            <p className="text-xs text-red mt-2">⚠ SOL has negative Kelly — historically losing</p>
          )}
        </div>

        <div className="space-y-6">
          <Slider label="Min Confidence" value={settings.min_confidence} min={40} max={90} step={1}
            format={(v) => `${v}`} onChange={(v) => setSettings((p) => ({ ...p, min_confidence: v }))} />
          <Slider label="Min Edge" value={settings.min_edge} min={0.02} max={0.20} step={0.01}
            format={(v) => `$${v.toFixed(2)}`} onChange={(v) => setSettings((p) => ({ ...p, min_edge: v }))} />
          <Slider label="Max Contract Price" value={settings.max_price} min={0.10} max={0.50} step={0.01}
            format={(v) => `$${v.toFixed(2)}`} onChange={(v) => setSettings((p) => ({ ...p, max_price: v }))} />
          <Slider label="BTC Kelly %" value={settings.kelly_btc * 100} min={2} max={40} step={1}
            format={(v) => `${v}%`} onChange={(v) => setSettings((p) => ({ ...p, kelly_btc: v / 100 }))} />
          <Slider label="ETH Kelly %" value={settings.kelly_eth * 100} min={2} max={30} step={1}
            format={(v) => `${v}%`} onChange={(v) => setSettings((p) => ({ ...p, kelly_eth: v / 100 }))} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          {[
            { key: "max_contracts_per_market", label: "Max Contracts / Market", min: 1, max: 100, note: "Prevents martingale" },
            { key: "daily_loss_limit", label: "Daily Loss Limit ($)", min: 0, step: 1, note: "0 = disabled" },
            { key: "interval", label: "Scan Interval (sec)", min: 15, max: 300, step: 5, note: "Between cycles" },
          ].map(({ key, label, min, max, step, note }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-text-secondary mb-2">{label}</label>
              <input type="number" min={min} max={max} step={step || 1}
                value={(settings as unknown as Record<string, number>)[key]}
                onChange={(e) => setSettings((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-primary border border-border text-text-primary font-mono text-sm focus:border-gold focus:outline-none"
              />
              <p className="text-xs text-text-secondary mt-1">{note}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex gap-3">
          <button onClick={saveSettings} disabled={saving}
            className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-gold to-gold-dark text-black font-bold text-sm hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50">
            {saving ? "Saving..." : "💾 Save Settings"}
          </button>
          <button onClick={() => setSettings(DEFAULT_SETTINGS)}
            className="px-5 py-2.5 rounded-xl bg-bg-card border border-border text-sm font-medium hover:border-gold/30 transition-colors">
            Reset Defaults
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">💡 How It Works</h2>
        <div className="space-y-3 text-sm text-text-secondary">
          {[
            ["📄", "PAPER mode", "simulates trades at real Kalshi prices. No money moves. Settlement is determined by actual Kalshi market results — so P&L is as real as it gets."],
            ["🔴", "LIVE mode", "places real orders on Kalshi with your API key. Only switch here when you're confident in the strategy."],
            ["🔀", "Switching modes", "takes effect on the next engine cycle. Stop and restart the autopilot to apply immediately."],
            ["🛡", "Max Contracts / Market", "caps contracts per ticker per cycle. This prevents the martingale effect that blew the account."],
            ["💀", "Daily Loss Limit", "kills the bot when losses exceed the threshold from session start. 0 disables it."],
          ].map(([icon, title, desc], i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-gold mt-0.5">{icon}</span>
              <p><strong className="text-text-primary">{title}</strong> {desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
