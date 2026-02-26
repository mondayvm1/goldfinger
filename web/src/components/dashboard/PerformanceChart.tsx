"use client";

import { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  BarElement,
  BarController,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  BarElement,
  BarController,
  Filler,
  Tooltip,
  Legend
);

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

interface PerformanceChartProps {
  trades: Trade[];
}

export function PerformanceChart({ trades }: PerformanceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    if (!canvasRef.current || trades.length === 0) return;

    // Destroy previous chart instance
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Sort all trades oldest-first (same as Phase 1 dashboard.py)
    const sorted = [...trades].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Labels: timestamp trimmed to time only (Phase 1: l.slice(11))
    const labels = sorted.map((t) => {
      const d = new Date(t.createdAt);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    });

    // Trade PnL bars: show PnL if settled, 0 if still cooking
    // (matches Phase 1 behavior: chart_trade_pnl.append(0) for null)
    const tradePnl = sorted.map((t) => (t.pnl !== null ? t.pnl : 0));

    // Cumulative PnL line (running total, same as Phase 1)
    const cumPnl: number[] = [];
    let cum = 0;
    for (const t of sorted) {
      if (t.pnl !== null) {
        cum += t.pnl;
      }
      cumPnl.push(parseFloat(cum.toFixed(4)));
    }

    // Original Phase 1 bar colors: neon green / red
    const barBg = tradePnl.map((v) =>
      v >= 0 ? "rgba(0, 255, 136, 0.5)" : "rgba(255, 68, 68, 0.5)"
    );
    const barBorder = tradePnl.map((v) =>
      v >= 0 ? "#00ff88" : "#ff4444"
    );

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    chartRef.current = new ChartJS(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Cumulative PnL ($)",
            data: cumPnl,
            type: "line",
            borderColor: "#d4af37",
            backgroundColor: "rgba(212, 175, 55, 0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: "#d4af37",
            yAxisID: "y",
            order: 0,
          },
          {
            label: "Trade PnL ($)",
            data: tradePnl,
            backgroundColor: barBg,
            borderColor: barBorder,
            borderWidth: 1,
            yAxisID: "y",
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#888" },
          },
        },
        scales: {
          x: {
            ticks: { color: "#555" },
            grid: { color: "rgba(255, 255, 255, 0.03)" },
          },
          y: {
            ticks: {
              color: "#888",
              callback: (v) => `$${Number(v).toFixed(2)}`,
            },
            grid: { color: "rgba(255, 255, 255, 0.05)" },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [trades]);

  if (trades.length === 0) return null;

  return (
    <section className="mb-8">
      <h2
        className="text-sm font-bold tracking-widest uppercase mb-4"
        style={{ color: "#d4af37", letterSpacing: "1px" }}
      >
        Performance
      </h2>
      <div
        className="relative rounded-xl p-4"
        style={{
          background: "rgba(255, 215, 0, 0.03)",
          border: "1px solid rgba(255, 215, 0, 0.12)",
          height: "260px",
        }}
      >
        <canvas ref={canvasRef} />
      </div>
    </section>
  );
}
