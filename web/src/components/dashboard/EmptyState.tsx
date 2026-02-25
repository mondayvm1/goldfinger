"use client";

interface EmptyStateProps {
  hasKeys: boolean;
  isScanning: boolean;
}

export function EmptyState({ hasKeys, isScanning }: EmptyStateProps) {
  if (!hasKeys) {
    return (
      <div className="glass-card p-12 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gold/10 flex items-center justify-center">
          <span className="text-4xl">🔑</span>
        </div>
        <h3 className="text-xl font-bold mb-2">Connect Your Kalshi Account</h3>
        <p className="text-text-secondary mb-6 max-w-md mx-auto">
          Add your Kalshi API credentials in Settings to start receiving
          premium trading signals.
        </p>
        <a
          href="/settings"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-gold to-gold-dark text-black font-bold hover:opacity-90 transition-all"
        >
          ⚙️ Go to Settings
        </a>
      </div>
    );
  }

  if (isScanning) {
    return (
      <div className="glass-card p-12 text-center">
        {/* Radar animation */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-gold/20" />
          <div className="absolute inset-2 rounded-full border border-gold/10" />
          <div className="absolute inset-4 rounded-full border border-gold/5" />
          <div className="absolute inset-0 origin-center radar-sweep">
            <div className="w-1/2 h-0.5 bg-gradient-to-r from-gold to-transparent absolute top-1/2 left-1/2" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-gold pulse-gold" />
          </div>
        </div>
        <h3 className="text-xl font-bold mb-2 gold-text">Scanning Markets</h3>
        <p className="text-text-secondary">
          Analyzing BTC, ETH, SOL prediction markets...
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-12 text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gold/10 flex items-center justify-center">
        <span className="text-4xl">📡</span>
      </div>
      <h3 className="text-xl font-bold mb-2">Ready to Scan</h3>
      <p className="text-text-secondary mb-6">
        Hit the scan button to detect live trading signals.
      </p>
    </div>
  );
}
