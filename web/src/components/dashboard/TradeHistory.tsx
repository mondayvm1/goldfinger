"use client";

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

interface TradeHistoryProps {
  trades: Trade[];
}

// Map Kalshi statuses to user-friendly labels
const STATUS_MAP: Record<string, { label: string; style: string }> = {
  resting: {
    label: "active",
    style: "bg-gold/10 text-gold border-gold/20",
  },
  pending: {
    label: "active",
    style: "bg-gold/10 text-gold border-gold/20",
  },
  filled: {
    label: "filled",
    style: "bg-green/10 text-green border-green/20",
  },
  settled: {
    label: "settled",
    style: "bg-green/10 text-green border-green/20",
  },
  cancelled: {
    label: "cancelled",
    style: "bg-red/10 text-red border-red/20",
  },
  canceled: {
    label: "cancelled",
    style: "bg-red/10 text-red border-red/20",
  },
};

function StatusBadge({ status }: { status: string }) {
  const mapped = STATUS_MAP[status] || {
    label: status,
    style: "bg-border text-text-secondary border-border",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium border ${mapped.style}`}
    >
      {mapped.label}
    </span>
  );
}

export function TradeHistory({ trades }: TradeHistoryProps) {
  if (trades.length === 0) {
    return (
      <div className="glass-card p-5">
        <h2 className="text-lg font-semibold mb-4">Trade History</h2>
        <div className="text-center py-10">
          <p className="text-text-secondary text-sm">
            No trades yet — execute a signal to see activity here
          </p>
        </div>
      </div>
    );
  }

  const netPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  return (
    <div className="glass-card p-5">
      <h2 className="text-lg font-semibold mb-4">
        Trade History
        <span className="ml-2 text-sm text-gold font-mono">
          ({trades.length})
        </span>
      </h2>
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-secondary text-xs uppercase tracking-wider">
              <th className="text-left pb-3 pr-4">Time</th>
              <th className="text-left pb-3 pr-4">Market</th>
              <th className="text-left pb-3 pr-4">Side</th>
              <th className="text-right pb-3 pr-4">Price</th>
              <th className="text-right pb-3 pr-4">Qty</th>
              <th className="text-right pb-3 pr-4">Fee</th>
              <th className="text-right pb-3 pr-4">PnL</th>
              <th className="text-center pb-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {trades.map((trade) => {
              const isLong = trade.side === "yes";
              const time = new Date(trade.createdAt);
              const pnlColor =
                trade.pnl === null
                  ? "text-gold"
                  : trade.pnl > 0
                  ? "text-green"
                  : trade.pnl < 0
                  ? "text-red"
                  : "text-text-secondary";

              return (
                <tr
                  key={trade.id}
                  className="hover:bg-bg-card-hover transition-colors"
                >
                  <td className="py-3 pr-4 font-mono text-xs text-text-secondary whitespace-nowrap">
                    {time.toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    {time.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-3 pr-4 font-medium whitespace-nowrap">
                    {trade.ticker.length > 20
                      ? trade.ticker.slice(0, 20) + "…"
                      : trade.ticker}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`font-bold text-xs ${
                        isLong ? "text-green" : "text-red"
                      }`}
                    >
                      {isLong ? "LONG" : "SHORT"}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono">
                    ${trade.price.toFixed(2)}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono">
                    {trade.count}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-text-secondary">
                    ${trade.fee.toFixed(4)}
                  </td>
                  <td className={`py-3 pr-4 text-right font-mono ${pnlColor}`}>
                    {trade.pnl !== null
                      ? `${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(4)}`
                      : "cooking…"}
                  </td>
                  <td className="py-3 text-center">
                    <StatusBadge status={trade.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gold/20">
              <td
                colSpan={6}
                className="py-3 pr-4 text-right font-bold text-sm uppercase tracking-wider"
                style={{ color: "#d4af37" }}
              >
                Net P&L
              </td>
              <td
                className={`py-3 pr-4 text-right font-mono font-bold text-sm ${
                  netPnl > 0
                    ? "text-green"
                    : netPnl < 0
                    ? "text-red"
                    : "text-text-secondary"
                }`}
              >
                {netPnl >= 0 ? "+" : ""}${netPnl.toFixed(4)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
