"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { SignalCard } from "@/components/dashboard/SignalCard";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { EmptyState } from "@/components/dashboard/EmptyState";

interface Signal {
  id: string;
  asset: string;
  direction: string;
  entry_price: number;
  payout: number;
  size: number;
  time_left: string;
  time_left_mins: number;
  signal_strength: number;
  signal_label: string;
}

interface Stats {
  balance: number;
  total_trades: number;
  realized_pnl: number;
  win_rate: number;
  wins: number;
  losses: number;
  open_positions: number;
}

export default function DashboardPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [scanning, setScanning] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [hasKeys, setHasKeys] = useState<boolean | null>(null);
  const [tradingId, setTradingId] = useState<string | null>(null);
  const [autoScan, setAutoScan] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoScanRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user has API keys configured
  useEffect(() => {
    fetch("/api/keys")
      .then((r) => r.json())
      .then((data) => setHasKeys(data.connected))
      .catch(() => setHasKeys(false));
  }, []);

  // Run a scan
  const runScan = useCallback(
    async (settle = true) => {
      if (isScanning || hasKeys === false) return;
      setIsScanning(true);
      setError(null);

      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settle }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Scan failed");
        }

        const data = await res.json();
        setSignals(data.signals || []);
        setStats(data.stats || null);
        setScanning(data.scanning || []);
        setLastScan(new Date());

        // Play alert for high-quality signals
        if (data.signals?.some((s: Signal) => s.signal_strength >= 4)) {
          playAlert();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Scan failed");
      } finally {
        setIsScanning(false);
      }
    },
    [isScanning, hasKeys]
  );

  // Execute a trade
  const executeTrade = async (signal: Signal) => {
    if (tradingId) return;
    setTradingId(signal.id);

    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: signal.id,
          side: signal.direction === "LONG" ? "yes" : "no",
          price: signal.entry_price,
          count: signal.size,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Re-scan to refresh stats
        setTimeout(() => runScan(false), 2000);
      } else {
        setError(data.error || "Trade failed");
      }
    } catch {
      setError("Trade execution failed");
    } finally {
      setTradingId(null);
    }
  };

  // Auto-scan toggle
  useEffect(() => {
    if (autoScan && hasKeys) {
      runScan(false); // Initial scan
      autoScanRef.current = setInterval(() => runScan(false), 45000);
    } else if (autoScanRef.current) {
      clearInterval(autoScanRef.current);
      autoScanRef.current = null;
    }
    return () => {
      if (autoScanRef.current) clearInterval(autoScanRef.current);
    };
  }, [autoScan, hasKeys, runScan]);

  // 3-tone alert beep
  const playAlert = () => {
    try {
      const ctx = new AudioContext();
      [800, 1000, 1200].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.value = 0.1;
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.12);
      });
    } catch {
      // Audio not available
    }
  };

  // Loading state while checking keys
  if (hasKeys === null) {
    return (
      <div className="space-y-6">
        <StatsRow stats={null} />
        <EmptyState hasKeys={true} isScanning={true} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Signal Dashboard</h1>
          {lastScan && (
            <p className="text-sm text-text-secondary">
              Last scan: {lastScan.toLocaleTimeString()}
              {scanning.length > 0 && ` (${scanning.join(", ")})`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-scan toggle */}
          <button
            onClick={() => setAutoScan(!autoScan)}
            disabled={!hasKeys}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              autoScan
                ? "bg-gold/20 text-gold border border-gold/30 pulse-gold"
                : "bg-bg-card text-text-secondary border border-border hover:border-gold/30"
            }`}
          >
            {autoScan ? "⏸ Auto: ON" : "▶ Auto: OFF"}
          </button>

          {/* Manual scan */}
          <button
            onClick={() => runScan(true)}
            disabled={isScanning || !hasKeys}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-gold to-gold-dark text-black font-bold text-sm hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isScanning ? "Scanning..." : "🔍 Scan Now"}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="glass-card p-4 border-red/30 bg-red/5 text-red flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red hover:text-red/70"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stats row */}
      <StatsRow stats={stats} />

      {/* Signals grid or empty state */}
      {signals.length > 0 ? (
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Active Signals
            <span className="ml-2 text-sm text-gold font-mono">
              ({signals.length})
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {signals.map((signal) => (
              <SignalCard
                key={signal.id}
                signal={signal}
                onTrade={executeTrade}
                isTrading={tradingId === signal.id}
              />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState hasKeys={hasKeys} isScanning={isScanning} />
      )}
    </div>
  );
}
