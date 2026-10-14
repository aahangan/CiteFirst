"use client";

import { useEffect, useState } from "react";
import { PLAN, TRIAL_DAYS } from "@/lib/brand";

type Preview = { count: number; cited: number; penalties: number; hot: number; areas: string[]; invalid: string[] };

const AUDIENCES = [
  { id: "safety", label: "Safety firm", hint: "Consulting / training" },
  { id: "defense", label: "Law firm", hint: "OSHA defense / employment" },
] as const;

export function SignupForm({ initialError, vertical: initialVertical }: { initialError: string | null; vertical: string }) {
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [vertical, setVertical] = useState(initialVertical);
  const [areas, setAreas] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  // Show how many cases their states produced last month, so they see the value before paying.
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/preview?vertical=${vertical}&areas=${encodeURIComponent(areas)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => d.count !== undefined && setPreview(d))
        .catch(() => {});
    }, 400);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [areas, vertical]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, email, areas, vertical }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.url) window.location.href = data.url;
    else { setError(data.error ?? "Something went wrong"); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <span className="mb-1.5 block text-sm font-medium">You are a</span>
        <div className="grid grid-cols-2 gap-2">
          {AUDIENCES.map((a) => (
            <button type="button" key={a.id} onClick={() => setVertical(a.id)}
              className={`rounded-lg border px-4 py-2.5 text-left text-sm ${vertical === a.id ? "border-signal bg-signal/5" : "border-line bg-card"}`}>
              <span className={`block font-medium ${vertical === a.id ? "text-signal" : ""}`}>{a.label}</span>
              <span className="text-xs text-muted">{a.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Firm name</span>
        <input className="field" required value={company} onChange={(e) => setCompany(e.target.value)} placeholder={vertical === "defense" ? "Smith & Lee LLP" : "Summit Safety Consulting"} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Work email</span>
        <input className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourfirm.com" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">States you cover</span>
        <input className="field" value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="TX, OK, LA … or leave blank for nationwide" />
      </label>

      {preview && (
        <div className="rounded-xl border border-line bg-background p-4 text-sm">
          {preview.invalid.length > 0 ? (
            <p className="text-signal">Not U.S. states: {preview.invalid.join(", ")}</p>
          ) : preview.count === 0 ? (
            <p className="text-muted">Loading recent OSHA activity…</p>
          ) : (
            <p>
              Last 30 days {preview.areas.length ? `in ${preview.areas.join(", ")}` : "nationwide"}: <b>{preview.count.toLocaleString()} cases</b>,{" "}
              {preview.cited.toLocaleString()} with citations totaling <b>${preview.penalties.toLocaleString()}</b> in penalties.
            </p>
          )}
        </div>
      )}

      <button disabled={busy} className="btn btn-signal w-full py-3.5 text-lg">{busy ? "Starting…" : `Start ${TRIAL_DAYS}-day free trial`}</button>
      {error && <p className="text-center text-sm text-signal">{error}</p>}
      <p className="text-center text-xs text-muted">{PLAN.base}/month after the trial. Cancel anytime before it ends and you won&apos;t be charged.</p>
    </form>
  );
}
