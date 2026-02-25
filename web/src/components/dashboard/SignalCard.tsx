"use client";

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

interface SignalCardProps {
  signal: Signal;
  onTrade: (signal: Signal) => void;
  isTrading?: boolean;
}

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`text-lg ${i <= count ? "star-filled" : "star-empty"}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export function SignalCard({ signal, onTrade, isTrading }: SignalCardProps) {
  const isLong = signal.direction === "LONG";

  return (
    <div className="glass-card p-5 flex flex-col gap-4">
      {/* Header: Asset + Direction badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold">{signal.asset}</span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              isLong
                ? "bg-green/10 text-green border border-green/20"
                : "bg-red/10 text-red border border-red/20"
            }`}
          >
            {signal.direction}
          </span>
        </div>
        <Stars count={signal.signal_strength} />
      </div>

      {/* Signal label */}
      <p className="text-sm text-gold font-medium">{signal.signal_label}</p>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-text-secondary">Entry</p>
          <p className="font-mono font-semibold">
            ${signal.entry_price.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-text-secondary">Payout</p>
          <p className="font-mono font-semibold text-green">
            ${signal.payout.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-text-secondary">Size</p>
          <p className="font-mono font-semibold">{signal.size}</p>
        </div>
        <div>
          <p className="text-text-secondary">Expires</p>
          <p className="font-mono font-semibold">{signal.time_left}</p>
        </div>
      </div>

      {/* Trade button */}
      <button
        onClick={() => onTrade(signal)}
        disabled={isTrading}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
          isTrading
            ? "bg-border text-text-secondary cursor-not-allowed"
            : isLong
            ? "bg-gradient-to-r from-green to-emerald-600 text-white hover:opacity-90 active:scale-[0.98]"
            : "bg-gradient-to-r from-red to-rose-600 text-white hover:opacity-90 active:scale-[0.98]"
        }`}
      >
        {isTrading ? "Executing..." : `${signal.direction} ${signal.asset}`}
      </button>
    </div>
  );
}
