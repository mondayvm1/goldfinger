"use client";

import { signIn } from "next-auth/react";

/* ── Stat counter shown in hero ──────────────────────────── */
function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl sm:text-3xl font-bold font-mono gold-text">
        {value}
      </p>
      <p className="text-xs sm:text-sm text-text-secondary mt-1">{label}</p>
    </div>
  );
}

/* ── Feature card ────────────────────────────────────────── */
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="glass-card p-6 sm:p-8 group hover:border-gold/40 transition-all duration-500">
      <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-text-secondary text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}

/* ── Step card (how it works) ────────────────────────────── */
function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="relative flex gap-5">
      {/* Step number */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-black font-bold text-sm">
        {step}
      </div>
      {/* Connecting line */}
      {step < 4 && (
        <div className="absolute left-5 top-12 w-px h-[calc(100%-12px)] bg-gradient-to-b from-gold/30 to-transparent" />
      )}
      <div className="pb-10">
        <h4 className="font-bold text-base mb-1">{title}</h4>
        <p className="text-text-secondary text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

/* ── Main landing page ───────────────────────────────────── */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-primary overflow-hidden">
      {/* ── Ambient background glows ── */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-gold/[0.03] blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[5%] w-[500px] h-[500px] rounded-full bg-gold/[0.02] blur-[120px]" />
      </div>

      {/* ── Navbar ── */}
      <nav className="relative z-20 border-b border-border/50 backdrop-blur-xl bg-bg-primary/60">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-lg shadow-gold/20">
              <span className="text-lg">&#9670;</span>
            </div>
            <span className="text-xl font-bold tracking-tight gold-text">
              GOLDFINGER
            </span>
          </div>
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-gold to-gold-dark text-black font-bold text-sm hover:opacity-90 transition-all active:scale-[0.97]"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 sm:pt-28 pb-20">
        {/* Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold/20 bg-gold/5 text-sm">
            <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
            <span className="text-text-secondary">
              Live on Kalshi &mdash; scanning now
            </span>
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-center text-4xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
          Find Mispriced
          <br />
          <span className="gold-text">Crypto Contracts</span>
          <br />
          Before Anyone Else
        </h1>

        <p className="text-center text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
          Goldfinger scans Kalshi&apos;s 15-minute crypto prediction markets
          in real time, pricing every contract with a quantitative model to
          surface trades with genuine edge.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-gold to-gold-dark text-black font-bold text-lg hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-gold/20"
          >
            Start Scanning Free
          </button>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl border border-border text-text-secondary font-medium text-lg hover:border-gold/30 hover:text-text-primary transition-all text-center"
          >
            See How It Works
          </a>
        </div>

        {/* Hero stats */}
        <div className="flex items-center justify-center gap-8 sm:gap-16">
          <HeroStat value="15m" label="Market Windows" />
          <div className="w-px h-10 bg-border" />
          <HeroStat value="BTC + ETH" label="Assets Tracked" />
          <div className="w-px h-10 bg-border hidden sm:block" />
          <HeroStat value="45s" label="Scan Frequency" />
        </div>
      </section>

      {/* ── Dashboard Preview ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <div className="relative rounded-2xl border border-border/60 bg-bg-card/50 backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/40">
          {/* Fake browser bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-bg-card/80">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red/60" />
              <div className="w-3 h-3 rounded-full bg-gold/60" />
              <div className="w-3 h-3 rounded-full bg-green/60" />
            </div>
            <div className="ml-3 flex-1 h-6 rounded-md bg-bg-primary/50 border border-border/30 flex items-center px-3">
              <span className="text-xs text-text-secondary font-mono">
                goldfinger.app/dashboard
              </span>
            </div>
          </div>
          {/* Mock dashboard content */}
          <div className="p-6 space-y-4">
            {/* Stat cards row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Balance", value: "$247.50" },
                { label: "Realized P&L", value: "+$47.50", color: "text-green" },
                { label: "Win Rate", value: "62.5%", color: "text-gold" },
                { label: "Trades", value: "5W / 3L" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="glass-card p-3 text-center hover:border-border"
                >
                  <p className="text-[10px] text-text-secondary mb-0.5">
                    {s.label}
                  </p>
                  <p
                    className={`text-sm font-bold font-mono ${s.color || "text-text-primary"}`}
                  >
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
            {/* Signal cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  asset: "BTC",
                  dir: "LONG",
                  stars: 4,
                  price: "$0.12",
                  payout: "$0.88",
                  time: "8 min",
                  conf: 72,
                },
                {
                  asset: "ETH",
                  dir: "SHORT",
                  stars: 3,
                  price: "$0.18",
                  payout: "$0.82",
                  time: "11 min",
                  conf: 61,
                },
                {
                  asset: "BTC",
                  dir: "LONG",
                  stars: 5,
                  price: "$0.08",
                  payout: "$0.92",
                  time: "6 min",
                  conf: 85,
                },
              ].map((sig, i) => (
                <div
                  key={i}
                  className="glass-card p-4 hover:border-border"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gold">
                      {sig.asset}
                    </span>
                    <span className="text-[10px] text-text-secondary">
                      {sig.time}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mb-2">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <span
                        key={s}
                        className={
                          s < sig.stars ? "star-filled text-xs" : "star-empty text-xs"
                        }
                      >
                        &#9733;
                      </span>
                    ))}
                    <span
                      className={`ml-auto text-xs font-bold ${sig.dir === "LONG" ? "text-green" : "text-red"}`}
                    >
                      {sig.dir}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-text-secondary">
                    <span>Entry {sig.price}</span>
                    <span>Payout {sig.payout}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Gradient overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-bg-primary to-transparent" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FEATURES / BENEFITS
      ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <p className="text-sm font-bold tracking-widest uppercase text-gold mb-3">
            Why Goldfinger
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold">
            Your Edge in Prediction Markets
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon="&#9889;"
            title="Real-Time Mispricing Detection"
            description="Scans every open Kalshi 15-minute crypto market every 45 seconds, pricing contracts with a Black-Scholes model to find genuine edge."
          />
          <FeatureCard
            icon="&#128200;"
            title="Quantitative Pricing Model"
            description="Fair values computed using log-normal distribution with EMA-20 trend confluence. Not vibes — math."
          />
          <FeatureCard
            icon="&#9733;"
            title="Confidence-Rated Signals"
            description="Every signal scored 0-100 on edge size, trend alignment, risk/reward ratio, and time window. Only the highest quality trades surface."
          />
          <FeatureCard
            icon="&#128274;"
            title="Bank-Grade Encryption"
            description="Your Kalshi API keys are encrypted with Fernet (AES-128-CBC) before storage. Decrypted only in memory, never logged, never stored in plaintext."
          />
          <FeatureCard
            icon="&#127919;"
            title="One-Click Execution"
            description="See a signal you like? Execute directly from the dashboard. Order goes straight to Kalshi with optimal limit pricing."
          />
          <FeatureCard
            icon="&#128241;"
            title="Mobile-Ready PWA"
            description="Works on any device. Install as an app on your phone — no app store needed. Get signals on the go."
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════════════════════ */}
      <section
        id="how-it-works"
        className="relative z-10 max-w-6xl mx-auto px-6 pb-24"
      >
        <div className="text-center mb-14">
          <p className="text-sm font-bold tracking-widest uppercase text-gold mb-3">
            How It Works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold">
            From Sign-Up to First Trade in 2 Minutes
          </h2>
        </div>

        <div className="max-w-xl mx-auto">
          <StepCard
            step={1}
            title="Sign in with Google"
            description="One click to create your account. No passwords to remember, no email verification."
          />
          <StepCard
            step={2}
            title="Connect your Kalshi account"
            description="Paste your Kalshi API key and private key in Settings. They're encrypted instantly and stored securely."
          />
          <StepCard
            step={3}
            title="Scan for signals"
            description="Hit Scan or enable Auto-Scan (every 45s). Goldfinger prices every open market and surfaces mispriced contracts."
          />
          <StepCard
            step={4}
            title="Execute with one click"
            description="Each signal shows entry price, payout, edge, and confidence. Like what you see? One tap to place the order."
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          THE MATH SECTION
      ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="glass-card p-8 sm:p-12 border-gold/10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-sm font-bold tracking-widest uppercase text-gold mb-3">
                The Model
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                Quantitative Edge,
                <br />
                Not Gut Feeling
              </h2>
              <p className="text-text-secondary leading-relaxed mb-6">
                Goldfinger prices every binary option using the Black-Scholes
                d2 term — the same framework used by institutional derivatives
                desks. When our fair value diverges from the market price,
                that&apos;s your edge.
              </p>
              <div className="space-y-3">
                {[
                  "Log-normal pricing model calibrated to crypto vol",
                  "EMA-20 trend filter for directional confluence",
                  "Kelly Criterion position sizing (fractional)",
                  "Minimum 2.5:1 reward-to-risk ratio on every trade",
                  "Counter-trend trades automatically penalized",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 text-sm"
                  >
                    <span className="text-gold mt-0.5">&#10003;</span>
                    <span className="text-text-secondary">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Formula display */}
            <div className="flex items-center justify-center">
              <div className="w-full max-w-sm p-6 rounded-2xl bg-bg-primary border border-border">
                <p className="text-xs text-text-secondary mb-4 font-mono uppercase tracking-wider">
                  Fair Value Computation
                </p>
                <div className="space-y-4 font-mono text-sm">
                  <div>
                    <span className="text-text-secondary">d2 = </span>
                    <span className="text-gold">
                      (ln(S/K) - 0.5&sigma;&sup2;T)
                    </span>
                    <span className="text-text-secondary"> / </span>
                    <span className="text-gold">&sigma;&radic;T</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div>
                    <span className="text-text-secondary">P(above) = </span>
                    <span className="text-green font-bold">&Phi;(d2)</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div>
                    <span className="text-text-secondary">Edge = </span>
                    <span className="text-gold">Fair Value</span>
                    <span className="text-text-secondary"> - </span>
                    <span className="text-red">Market Price</span>
                  </div>
                </div>
                <p className="text-[10px] text-text-secondary mt-4">
                  S = spot price, K = strike, &sigma; = volatility, T = time
                  to expiry
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FINAL CTA
      ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to Find
            <span className="gold-text"> Your Edge</span>?
          </h2>
          <p className="text-text-secondary text-lg mb-8 max-w-lg mx-auto">
            Join Goldfinger and start scanning Kalshi markets for mispriced
            crypto contracts. Free to start.
          </p>
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="px-10 py-4 rounded-2xl bg-gradient-to-r from-gold to-gold-dark text-black font-bold text-lg hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-gold/20"
          >
            Get Started &mdash; It&apos;s Free
          </button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════ */}
      <footer className="relative z-10 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center">
              <span className="text-sm">&#9670;</span>
            </div>
            <span className="font-bold gold-text">GOLDFINGER</span>
          </div>
          <p className="text-text-secondary text-xs text-center sm:text-right">
            Not financial advice. Trading prediction markets involves risk.
            <br />
            Kalshi is a regulated exchange (CFTC). Goldfinger is an independent
            tool.
          </p>
        </div>
      </footer>
    </div>
  );
}
