"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { SignalCard } from "@/components/dashboard/SignalCard";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { TradeHistory } from "@/components/dashboard/TradeHistory";

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

interface Trade {
  id: string;
  ticker: string;
  side: string;
  price: number;
  count: number;
  fee: number;
  pnl: number | null;
  status: string;
  createdAt: string;
}

export default function DashboardPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [scanning, setScanning] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [hasKeys, setHasKeys] = useState<boolean | null>(null);
  const [tradingId, setTradingId] = useState<string | null>(null);
  const [autoScan, setAutoScan] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoScanRef = useRef<NodeJS.Timeout | null>(null);
  // Duplicate order prevention: track recently executed tickers
  const recentTrades = useRef<Map<string, number>>(new Map());

  // Check if user has API keys configured
  useEffect(() => {
    fetch("/api/keys")
      .then((r) => r.json())
      .then((data) => setHasKeys(data.connected))
      .catch(() => setHasKeys(false));
  }, []);

  // Fetch trade history
  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch("/api/trades");
      if (res.ok) {
        const data = await res.json();
        setTrades(data.trades || []);
      }
    } catch {
      // Silently fail — trades are supplementary
    }
  }, []);

  // Sync trade settlements from Kalshi
  const syncTradeSettlements = useCallback(async () => {
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.synced > 0) {
          // Trades were updated — refresh the list
          await fetchTrades();
        }
      }
    } catch {
      // Silently fail
    }
  }, [fetchTrades]);

  // Load trades + sync on mount
  useEffect(() => {
    if (hasKeys) {
      fetchTrades().then(() => syncTradeSettlements());
    }
  }, [hasKeys, fetchTrades, syncTradeSettlements]);

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

        // Play alert when any signals are found
        if (data.signals?.length > 0) {
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

  // Execute a trade — with duplicate prevention (120s cooldown per ticker)
  const executeTrade = async (signal: Signal) => {
    if (tradingId) return;

    // Duplicate guard: block same ticker within 120 seconds
    const now = Date.now();
    const lastTradeTime = recentTrades.current.get(signal.id);
    if (lastTradeTime && now - lastTradeTime < 120_000) {
      const secsLeft = Math.ceil((120_000 - (now - lastTradeTime)) / 1000);
      setError(`Already traded ${signal.id} recently. Cooldown: ${secsLeft}s`);
      return;
    }

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
        // Mark ticker as recently traded
        recentTrades.current.set(signal.id, Date.now());
        // Refresh trades + re-scan to update stats
        fetchTrades();
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
      syncTradeSettlements(); // Sync settlements immediately
      autoScanRef.current = setInterval(() => {
        runScan(false);
        syncTradeSettlements(); // Sync + refresh trades each cycle
      }, 45000);
    } else if (autoScanRef.current) {
      clearInterval(autoScanRef.current);
      autoScanRef.current = null;
    }
    return () => {
      if (autoScanRef.current) clearInterval(autoScanRef.current);
    };
  }, [autoScan, hasKeys, runScan, syncTradeSettlements]);

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

  // Derive "cooking" trades (pending/filled, no PnL yet)
  const cookingTrades = trades.filter(
    (t) => t.pnl === null && t.status !== "cancelled"
  );

  // Compute stats from DB trades (engine multi-user mode returns zeros)
  const dbStats = (() => {
    if (trades.length === 0) return null;
    let realized_pnl = 0;
    let wins = 0;
    let losses = 0;
    for (const t of trades) {
      if (t.pnl !== null) {
        realized_pnl += t.pnl;
        if (t.pnl > 0) wins++;
        else if (t.pnl < 0) losses++;
      }
    }
    const settled = wins + losses;
    const win_rate = settled > 0 ? (wins / settled) * 100 : 0;
    return {
      balance: stats?.balance ?? 0,
      total_trades: trades.length,
      realized_pnl: parseFloat(realized_pnl.toFixed(4)),
      win_rate: parseFloat(win_rate.toFixed(1)),
      wins,
      losses,
      open_positions: cookingTrades.length,
    };
  })();

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

      {/* Stats row — computed from DB trades, balance from scan */}
      <StatsRow stats={dbStats} />

      {/* Cooking trades banner */}
      {cookingTrades.length > 0 && (
        <div className="glass-card p-4 border-gold/20 bg-gold/5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-lg">🍳</span>
            <h3 className="font-semibold text-gold">
              Cooking
              <span className="ml-1 text-sm font-mono">
                ({cookingTrades.length})
              </span>
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {cookingTrades.map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between bg-bg-card/50 rounded-lg px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-bold text-xs ${
                      trade.side === "yes" ? "text-green" : "text-red"
                    }`}
                  >
                    {trade.side === "yes" ? "LONG" : "SHORT"}
                  </span>
                  <span className="font-medium text-text-primary truncate max-w-[140px]">
                    {trade.ticker}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-text-secondary">
                    ${trade.price.toFixed(2)} × {trade.count}
                  </span>
                  <span className="inline-block w-2 h-2 rounded-full bg-gold pulse-gold" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Performance Chart */}
      {trades.length > 0 && <PerformanceChart trades={trades} />}

      {/* Trade History */}
      <TradeHistory trades={trades} />
    </div>
  );
}
