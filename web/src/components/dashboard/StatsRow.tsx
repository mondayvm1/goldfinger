"use client";

interface Stats {
  balance: number;
  total_trades: number;
  realized_pnl: number;
  win_rate: number;
  wins: number;
  losses: number;
  open_positions: number;
}

interface StatsRowProps {
  stats: Stats | null;
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="glass-card p-4 text-center">
      <p className="text-xs text-text-secondary mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${color || ""}`}>{value}</p>
    </div>
  );
}

export function StatsRow({ stats }: StatsRowProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card p-4 text-center animate-pulse">
            <div className="h-3 w-16 bg-border rounded mx-auto mb-2" />
            <div className="h-6 w-20 bg-border rounded mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  const pnlColor =
    stats.realized_pnl > 0
      ? "text-green"
      : stats.realized_pnl < 0
      ? "text-red"
      : "";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Balance" value={`$${stats.balance.toFixed(2)}`} />
      <StatCard
        label="Realized P&L"
        value={`${stats.realized_pnl >= 0 ? "+" : ""}$${stats.realized_pnl.toFixed(2)}`}
        color={pnlColor}
      />
      <StatCard
        label="Win Rate"
        value={`${stats.win_rate.toFixed(1)}%`}
        color="text-gold"
      />
      <StatCard
        label="Trades"
        value={`${stats.wins}W / ${stats.losses}L`}
      />
    </div>
  );
}
