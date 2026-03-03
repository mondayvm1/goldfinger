"use client";

import { useState, useEffect, useCallback } from "react";

interface EngineSettings {
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

const DEFAULT_SETTINGS: EngineSettings = {
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
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium text-text-secondary">{label}</label>
        <span className="text-sm font-mono text-gold font-bold">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-gold bg-bg-primary"
      />
      <div className="flex justify-between text-xs text-text-secondary mt-1">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

export default function EnginePage() {
  const [settings, setSettings] = useState<EngineSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<EngineStatus>({ running: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showKillConfirm, setShowKillConfirm] = useState(false);

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/engine/autopilot");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ running: false, error: "Engine unreachable" });
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/engine/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchSettings, fetchStatus]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/engine/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        showMsg("success", "Settings saved — takes effect on next cycle");
      } else {
        const d = await res.json();
        showMsg("error", d.error || "Failed to save");
      }
    } catch {
      showMsg("error", "Engine unreachable");
    } finally {
      setSaving(false);
    }
  };

  const autopilotAction = async (action: "start" | "stop" | "kill") => {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/engine/autopilot?action=${action}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showMsg("success", data.message || `${action} sent`);
        setTimeout(fetchStatus, 1500);
      } else {
        showMsg("error", data.error || `${action} failed`);
      }
    } catch {
      showMsg("error", "Engine unreachable");
    } finally {
      setActionLoading(null);
      setShowKillConfirm(false);
    }
  };

  const toggleAsset = (asset: string) => {
    setSettings((prev) => ({
      ...prev,
      enabled_assets: prev.enabled_assets.includes(asset)
        ? prev.enabled_assets.filter((a) => a !== asset)
        : [...prev.enabled_assets, asset],
    }));
  };

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

      {/* Message toast */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between ${
            message.type === "success"
              ? "bg-green/10 border border-green/20 text-green"
              : "bg-red/10 border border-red/20 text-red"
          }`}
        >
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-4 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Status + Controls */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                status.running ? "bg-green pulse-gold" : "bg-text-secondary"
              }`}
            />
            <h2 className="text-lg font-semibold">
              Autopilot {status.running ? "Running" : "Stopped"}
            </h2>
          </div>
          {status.running && status.cycle !== undefined && (
            <span className="text-xs text-text-secondary font-mono">
              cycle #{status.cycle} · {status.trades_fired ?? 0} trades fired
            </span>
          )}
        </div>

        {status.error && !status.running && (
          <div className="mb-4 p-3 rounded-xl bg-red/5 border border-red/20 text-red text-sm">
            {status.error}
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => autopilotAction("start")}
            disabled={status.running || actionLoading !== null}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-gold to-gold-dark text-black font-bold text-sm hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {actionLoading === "start" ? "Starting..." : "▶ Start"}
          </button>

          <button
            onClick={() => autopilotAction("stop")}
            disabled={!status.running || actionLoading !== null}
            className="px-6 py-2.5 rounded-xl bg-bg-card border border-border text-sm font-medium hover:border-gold/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {actionLoading === "stop" ? "Stopping..." : "⏸ Stop"}
          </button>

          <button
            onClick={() => setShowKillConfirm(true)}
            disabled={actionLoading !== null}
            className="px-6 py-2.5 rounded-xl bg-red/10 border border-red/20 text-red text-sm font-medium hover:bg-red/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {actionLoading === "kill" ? "Killing..." : "☠ Kill + Cancel All"}
          </button>
        </div>
      </div>

      {/* Kill confirmation */}
      {showKillConfirm && (
        <div className="glass-card p-6 border border-red/30 bg-red/5">
          <h3 className="font-semibold text-red mb-2">Confirm Kill</h3>
          <p className="text-sm text-text-secondary mb-4">
            This will stop the autopilot and cancel all open orders on Kalshi. Are you sure?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => autopilotAction("kill")}
              className="px-5 py-2 rounded-xl bg-red text-white font-bold text-sm hover:opacity-90"
            >
              {actionLoading === "kill" ? "Killing..." : "Yes, Kill It"}
            </button>
            <button
              onClick={() => setShowKillConfirm(false)}
              className="px-5 py-2 rounded-xl bg-bg-card border border-border text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Risk Parameters */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-6">Risk Parameters</h2>

        {/* Asset toggles */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-secondary mb-3">Active Assets</label>
          <div className="flex gap-2">
            {["BTC", "ETH", "SOL"].map((asset) => {
              const active = settings.enabled_assets.includes(asset);
              return (
                <button
                  key={asset}
                  onClick={() => toggleAsset(asset)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                    active
                      ? "bg-gold/20 text-gold border-gold/40"
                      : "bg-bg-card text-text-secondary border-border hover:border-gold/20"
                  }`}
                >
                  {asset}
                </button>
              );
            })}
          </div>
          {settings.enabled_assets.includes("SOL") && (
            <p className="text-xs text-red mt-2">⚠ SOL has negative Kelly (-7.6%) — historically losing</p>
          )}
        </div>

        <div className="space-y-6">
          <Slider
            label="Min Confidence"
            value={settings.min_confidence}
            min={40}
            max={90}
            step={1}
            format={(v) => `${v}`}
            onChange={(v) => setSettings((p) => ({ ...p, min_confidence: v }))}
          />

          <Slider
            label="Min Edge"
            value={settings.min_edge}
            min={0.02}
            max={0.20}
            step={0.01}
            format={(v) => `$${v.toFixed(2)}`}
            onChange={(v) => setSettings((p) => ({ ...p, min_edge: v }))}
          />

          <Slider
            label="Max Contract Price"
            value={settings.max_price}
            min={0.10}
            max={0.50}
            step={0.01}
            format={(v) => `$${v.toFixed(2)}`}
            onChange={(v) => setSettings((p) => ({ ...p, max_price: v }))}
          />

          <Slider
            label="BTC Kelly %"
            value={settings.kelly_btc * 100}
            min={2}
            max={40}
            step={1}
            format={(v) => `${v}%`}
            onChange={(v) => setSettings((p) => ({ ...p, kelly_btc: v / 100 }))}
          />

          <Slider
            label="ETH Kelly %"
            value={settings.kelly_eth * 100}
            min={2}
            max={30}
            step={1}
            format={(v) => `${v}%`}
            onChange={(v) => setSettings((p) => ({ ...p, kelly_eth: v / 100 }))}
          />

          {/* Numeric inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Max Contracts / Market
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={settings.max_contracts_per_market}
                onChange={(e) =>
                  setSettings((p) => ({
                    ...p,
                    max_contracts_per_market: Math.max(1, parseInt(e.target.value) || 1),
                  }))
                }
                className="w-full px-3 py-2.5 rounded-xl bg-bg-primary border border-border text-text-primary font-mono text-sm focus:border-gold focus:outline-none"
              />
              <p className="text-xs text-text-secondary mt-1">Prevents martingale</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Daily Loss Limit ($)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={settings.daily_loss_limit}
                onChange={(e) =>
                  setSettings((p) => ({
                    ...p,
                    daily_loss_limit: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full px-3 py-2.5 rounded-xl bg-bg-primary border border-border text-text-primary font-mono text-sm focus:border-gold focus:outline-none"
              />
              <p className="text-xs text-text-secondary mt-1">0 = disabled</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Scan Interval (sec)
              </label>
              <input
                type="number"
                min={15}
                max={300}
                step={5}
                value={settings.interval}
                onChange={(e) =>
                  setSettings((p) => ({
                    ...p,
                    interval: Math.max(15, parseInt(e.target.value) || 45),
                  }))
                }
                className="w-full px-3 py-2.5 rounded-xl bg-bg-primary border border-border text-text-primary font-mono text-sm focus:border-gold focus:outline-none"
              />
              <p className="text-xs text-text-secondary mt-1">Between cycles</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-gold to-gold-dark text-black font-bold text-sm hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "Saving..." : "💾 Save Settings"}
          </button>
          <button
            onClick={() => setSettings(DEFAULT_SETTINGS)}
            className="px-5 py-2.5 rounded-xl bg-bg-card border border-border text-sm font-medium hover:border-gold/30 transition-colors"
          >
            Reset Defaults
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">💡 How It Works</h2>
        <div className="space-y-3 text-sm text-text-secondary">
          <div className="flex items-start gap-3">
            <span className="text-gold mt-0.5">1</span>
            <p>Settings save to <span className="font-mono text-text-primary">data/settings.json</span> on the engine host and are picked up on the <strong>next cycle</strong> — no restart needed.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-gold mt-0.5">2</span>
            <p><strong>Max Contracts / Market</strong> caps how many contracts the bot can buy on a single ticker per cycle. This prevents the martingale effect that blew the account.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-gold mt-0.5">3</span>
            <p><strong>Daily Loss Limit</strong> kills the bot automatically when losses exceed the threshold from session start. Set to 0 to disable.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-gold mt-0.5">4</span>
            <p><strong>Kill + Cancel All</strong> stops the engine and sends cancel requests for all open orders on Kalshi. Use in emergencies.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
