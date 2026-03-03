"use client";

import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [connected, setConnected] = useState(false);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Check current key status
  useEffect(() => {
    fetch("/api/keys")
      .then((r) => r.json())
      .then((data) => {
        setConnected(data.connected);
        setConnectedAt(data.connectedAt);
      })
      .catch(() => {});
  }, []);

  // Save keys
  const handleSave = async () => {
    if (!apiKey.trim() || !privateKey.trim()) {
      setMessage({ type: "error", text: "Both fields are required." });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), privateKey: privateKey.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "API keys saved and encrypted!" });
        setConnected(true);
        setConnectedAt(new Date().toISOString());
        setApiKey("");
        setPrivateKey("");
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error." });
    } finally {
      setSaving(false);
    }
  };

  // Delete keys
  const handleDelete = async () => {
    setDeleting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/keys", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "API keys removed." });
        setConnected(false);
        setConnectedAt(null);
      } else {
        setMessage({ type: "error", text: data.error || "Failed to remove." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error." });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-text-secondary">
          Manage your exchange connections and preferences.
        </p>
      </div>

      {/* Connection status */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                connected ? "bg-green pulse-gold" : "bg-text-secondary"
              }`}
            />
            <h2 className="text-lg font-semibold">Kalshi Connection</h2>
          </div>
          {connected && (
            <span className="text-xs text-text-secondary">
              Connected{" "}
              {connectedAt &&
                new Date(connectedAt).toLocaleDateString()}
            </span>
          )}
        </div>

        {connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green/5 border border-green/20">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-medium text-green">Connected & Encrypted</p>
                <p className="text-sm text-text-secondary">
                  Your Kalshi API credentials are stored with Fernet encryption.
                  The engine decrypts them only in memory during scans.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConnected(false)}
                className="px-4 py-2 rounded-xl bg-bg-card border border-border text-sm font-medium hover:border-gold/30 transition-colors"
              >
                Update Keys
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-red/10 border border-red/20 text-red text-sm font-medium hover:bg-red/20 transition-colors"
              >
                {deleting ? "Removing..." : "Remove Keys"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Enter your Kalshi API credentials. They will be encrypted with
              Fernet and never stored in plaintext.
            </p>

            {/* API Key */}
            <div>
              <label className="block text-sm font-medium mb-2">
                API Key ID
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-4 py-3 rounded-xl bg-bg-primary border border-border text-text-primary font-mono text-sm focus:border-gold focus:outline-none transition-colors"
              />
              <p className="text-xs text-text-secondary mt-1">
                Get from:{" "}
                <a
                  href="https://kalshi.com/account/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold hover:underline"
                >
                  kalshi.com/account/api
                </a>
              </p>
            </div>

            {/* Private Key (PEM) */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Private Key (PEM)
              </label>
              <textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}
                rows={6}
                className="w-full px-4 py-3 rounded-xl bg-bg-primary border border-border text-text-primary font-mono text-xs focus:border-gold focus:outline-none transition-colors resize-none"
              />
              <p className="text-xs text-text-secondary mt-1">
                Paste your full PEM private key including the BEGIN/END lines.
              </p>
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving || !apiKey.trim() || !privateKey.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-gold to-gold-dark text-black font-bold text-sm hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Encrypting & Saving..." : "🔐 Save & Encrypt Keys"}
            </button>
          </div>
        )}

        {/* Message */}
        {message && (
          <div
            className={`mt-4 p-3 rounded-xl text-sm ${
              message.type === "success"
                ? "bg-green/10 text-green border border-green/20"
                : "bg-red/10 text-red border border-red/20"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      {/* Security info */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">🔒 Security</h2>
        <div className="space-y-3 text-sm text-text-secondary">
          <div className="flex items-start gap-3">
            <span className="text-gold mt-0.5">&#10003;</span>
            <p>
              API keys are encrypted with <span className="text-text-primary font-medium">Fernet (AES-128-CBC)</span> before storage.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-gold mt-0.5">&#10003;</span>
            <p>
              Credentials are decrypted <span className="text-text-primary font-medium">only in memory</span> during scan/trade operations.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-gold mt-0.5">&#10003;</span>
            <p>
              The engine never stores credentials on disk. All API responses pass through <span className="text-text-primary font-medium">Fort Knox firewall</span>.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-gold mt-0.5">&#10003;</span>
            <p>
              You can remove your keys at any time. We never have access to your exchange funds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
