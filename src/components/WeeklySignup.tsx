"use client";

import { useState } from "react";

const NOTICES: Record<string, string> = {
  confirmed: "You're subscribed. Your first weekly report arrives Monday morning.",
  unsubscribed: "You're unsubscribed from the weekly report.",
};

export function WeeklySignup({ state, stateName, notice }: { state: string; stateName: string; notice?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("busy");
    setError(null);
    const res = await fetch("/api/weekly", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, state }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setStatus("sent");
    else { setError(data.error ?? "Something went wrong"); setStatus("idle"); }
  }

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <p className="font-semibold">Free weekly {stateName} OSHA report</p>
      <p className="mt-1 mb-3 text-sm text-muted">Every Monday: how many {stateName} employers OSHA cited, the penalties, the most cited standards and the largest cases. No card, unsubscribe anytime.</p>
      {notice && NOTICES[notice] && <p className="mb-3 text-sm font-medium text-signal">{NOTICES[notice]}</p>}
      {status === "sent" ? (
        <p className="text-sm">Check your inbox for a confirmation link.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-wrap gap-2">
          <input className="field min-w-0 flex-1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" aria-label="Email" />
          <button disabled={status === "busy"} className="btn border border-foreground px-4 py-2 text-sm">{status === "busy" ? "Sending…" : "Send it weekly"}</button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-signal">{error}</p>}
    </div>
  );
}
