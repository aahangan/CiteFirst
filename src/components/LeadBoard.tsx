"use client";

import { useMemo, useState } from "react";
import type { LeadState, LeadStatus } from "@/lib/accounts";
import type { VerticalLabels } from "@/engine/schema";
import type { Lead } from "@/lib/geo";
import { LeadSummary } from "./LeadCard";

const STATUSES: { id: LeadStatus; label: string }[] = [
  { id: "new", label: "New" },
  { id: "called", label: "Called" },
  { id: "quoted", label: "Quoted" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

type Draft = { callScript: string; email: { subject: string; body: string }; letter: string };

export function LeadBoard({ leads, initialStates, labels }: { leads: Lead[]; initialStates: Record<string, LeadState>; labels: VerticalLabels }) {
  const [states, setStates] = useState(initialStates);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<"all" | Lead["kind"]>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"heat" | "date">("heat");
  const [outreachFor, setOutreachFor] = useState<Lead | null>(null);

  const statusOf = (id: string) => states[id]?.status ?? "new";
  const categoriesPresent = useMemo(() => [...new Set(leads.flatMap((l) => l.categories))], [leads]);
  const industriesPresent = useMemo(() => [...new Set(leads.map((l) => l.industry).filter((x): x is string => !!x))].sort(), [leads]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length };
    for (const l of leads) c[statusOf(l.id)] = (c[statusOf(l.id)] ?? 0) + 1;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, states]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads
      .filter((l) => statusFilter === "all" || statusOf(l.id) === statusFilter)
      .filter((l) => categoryFilter === "all" || l.categories.includes(categoryFilter))
      .filter((l) => kindFilter === "all" || l.kind === kindFilter)
      .filter((l) => industryFilter === "all" || l.industry === industryFilter)
      .filter((l) => !q || `${l.name} ${l.address} ${l.city} ${l.state} ${l.zip} ${l.industry ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => (sort === "heat" ? b.heat - a.heat || b.published.localeCompare(a.published) : b.published.localeCompare(a.published) || b.heat - a.heat));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, states, statusFilter, categoryFilter, kindFilter, industryFilter, query, sort]);

  async function update(leadId: string, patch: Partial<LeadState>) {
    const next: LeadState = { ...states[leadId], status: patch.status ?? statusOf(leadId), note: patch.note ?? states[leadId]?.note, updatedAt: states[leadId]?.updatedAt ?? 0 }; // the server stamps the real time
    setStates((s) => ({ ...s, [leadId]: next }));
    await fetch("/api/leads/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, status: next.status, note: next.note }),
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {([{ id: "all", label: "All" }, ...STATUSES] as const).map((s) => (
          <button key={s.id} onClick={() => setStatusFilter(s.id)}
            className={`rounded-full border px-3 py-1 text-sm ${statusFilter === s.id ? "border-foreground bg-foreground text-white" : "border-line bg-card text-muted hover:text-foreground"}`}>
            {s.label} <span className="opacity-60">{counts[s.id] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        <input className="field w-full py-2 text-sm sm:w-auto sm:max-w-xs sm:flex-1" placeholder="Search employer, city, state…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="field w-auto py-2 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">All types</option>
          {categoriesPresent.map((c) => <option key={c} value={c}>{labels.categories[c] ?? c}</option>)}
        </select>
        <select className="field w-auto py-2 text-sm" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as "all" | Lead["kind"])}>
          <option value="all">Inspections & citations</option>
          <option value="citation">Cited only</option>
          <option value="inspection">Open inspections only</option>
        </select>
        {industriesPresent.length > 1 && (
          <select className="field w-auto py-2 text-sm" value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)}>
            <option value="all">All industries</option>
            {industriesPresent.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        )}
        <select className="field w-auto py-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as "heat" | "date")}>
          <option value="heat">Hottest first</option>
          <option value="date">Newest published first</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">
          {leads.length === 0 ? `No ${labels.noun.plural} in your states for this period. Try a longer range or add states in Settings.` : "No leads match these filters."}
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
          {visible.map((l) => (
            <LeadRow key={l.id} lead={l} labels={labels} state={states[l.id]} onUpdate={(p) => update(l.id, p)} onOutreach={() => setOutreachFor(l)} />
          ))}
        </ul>
      )}

      {outreachFor && <OutreachModal lead={outreachFor} onClose={() => setOutreachFor(null)} />}
    </>
  );
}

function LeadRow({ lead, labels, state, onUpdate, onOutreach }: { lead: Lead; labels: VerticalLabels; state?: LeadState; onUpdate: (p: Partial<LeadState>) => void; onOutreach: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(state?.note ?? "");
  const status = state?.status ?? "new";
  return (
    <li className="p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="min-w-0 flex-1"><LeadSummary lead={lead} labels={labels} /></div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-col md:items-stretch">
          <select value={status} onChange={(e) => onUpdate({ status: e.target.value as LeadStatus })}
            className={`field w-32 py-1.5 text-sm font-medium ${status === "won" ? "border-emerald-500 text-emerald-700" : status === "new" ? "" : "border-foreground"}`}>
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button onClick={onOutreach} className="btn btn-signal px-3 py-1.5 text-sm">Draft outreach</button>
          <button onClick={() => setOpen(!open)} className="text-sm text-muted underline">{open ? "Hide details" : "Details & notes"}</button>
        </div>
      </div>
      {open && (
        <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{lead.kind === "citation" ? `Cited items · issued ${lead.date}` : "Inspection"}</p>
            <ul className="space-y-1.5 text-sm">{lead.notes.map((n, i) => <li key={i}>• {n}</li>)}</ul>
            <p className="mt-2 text-xs text-muted">
              {[lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(", ")} · Inspection #{lead.activityNr} · {lead.inspectionType}
              {lead.scope ? `, ${lead.scope.toLowerCase()} scope` : ""} · opened {lead.openDate}{lead.union ? " · union site" : ""}
            </p>
            {lead.abateBy && <p className="mt-1 text-xs text-muted">OSHA&apos;s last abatement (fix-by) date for the cited items: {lead.abateBy}.{lead.contested ? " The employer has contested, which pauses abatement for contested items." : ""}</p>}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Your notes</p>
            <textarea className="field text-sm" rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (state?.note ?? "") && onUpdate({ note })}
              placeholder="Left message with safety manager, follow up Thursday…" />
          </div>
        </div>
      )}
    </li>
  );
}

function OutreachModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"call" | "email" | "letter">("call");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/leads/outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: lead.id }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setDraft(data.draft);
    else setError(data.error ?? "Drafting failed");
    setLoading(false);
  }

  const text = !draft ? "" : tab === "call" ? draft.callScript : tab === "email" ? `Subject: ${draft.email.subject}\n\n${draft.email.body}` : draft.letter;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">Outreach for {lead.name}</h2>
            <p className="text-sm text-muted">Written from the public OSHA case record. Review and edit before you use it.</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close">✕</button>
        </div>
        {!draft ? (
          <div className="py-8 text-center">
            <button onClick={generate} disabled={loading} className="btn btn-signal px-6 py-3">{loading ? "Writing…" : "Write call script, email & letter"}</button>
            {error && <p className="mt-3 text-sm text-signal">{error}</p>}
          </div>
        ) : (
          <>
            <div className="mb-3 flex gap-1 rounded-lg border border-line p-1 text-sm">
              {([["call", "Call script"], ["email", "Email"], ["letter", "Letter"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => { setTab(id); setCopied(false); }} className={`flex-1 rounded-md py-1.5 ${tab === id ? "bg-foreground text-white" : "text-muted"}`}>{label}</button>
              ))}
            </div>
            <pre className="flex-1 overflow-auto rounded-lg bg-background p-4 font-sans text-sm whitespace-pre-wrap">{text}</pre>
            <div className="mt-4 flex justify-between gap-2">
              <button onClick={generate} disabled={loading} className="btn btn-ghost px-4 py-2 text-sm">{loading ? "Rewriting…" : "Rewrite"}</button>
              <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); }} className="btn btn-signal px-4 py-2 text-sm">{copied ? "Copied ✓" : "Copy"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
