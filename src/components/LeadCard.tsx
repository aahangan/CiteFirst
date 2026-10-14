import type { VerticalLabels } from "@/engine/schema";
import { type Lead, shortDate, STATES, usd } from "@/lib/geo";

export function heatColor(heat: number) {
  return heat >= 75 ? "bg-signal text-white" : heat >= 55 ? "bg-amber text-night" : "bg-zinc-200 text-zinc-700";
}

export function daysAgoLabel(date: string) {
  const d = Math.round((Date.now() - new Date(`${date}T12:00:00`).getTime()) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}

/** Calendar days until a date, or null once it has passed. */
export function daysUntil(date: string) {
  const d = Math.ceil((new Date(`${date}T23:59:59`).getTime() - Date.now()) / 86400000);
  return d >= 0 ? d : null;
}

/** OSHA's public page for one inspection. */
export const inspectionUrl = (activityNr: string) => `https://www.osha.gov/ords/imis/establishment.inspection_detail?id=${activityNr}`;

/** Read-only lead summary shared by the demo, landing page and dashboard. `masked` hides the employer's identity. */
export function LeadSummary({ lead, labels, masked = false }: { lead: Lead; labels: VerticalLabels; masked?: boolean }) {
  const query = encodeURIComponent(`${lead.name} ${lead.city} ${lead.state}`);
  const left = lead.abateBy ? daysUntil(lead.abateBy) : null;
  const where = [lead.city, STATES[lead.state] ? lead.state : null].filter(Boolean).join(", ");
  return (
    <div className="flex gap-4">
      <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl font-bold ${heatColor(lead.heat)}`} title="Heat score: how urgent and valuable this case likely is">
        <span className="text-lg leading-none">{lead.heat}</span>
        <span className="text-[9px] tracking-wider uppercase opacity-80">heat</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className={`font-semibold ${masked ? "select-none blur-[5px]" : ""}`}>{masked ? "Hidden Employer Name LLC" : lead.name}</h3>
          {lead.flags.map((f) => (
            <span key={f} className="rounded bg-amber/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">{labels.flags[f] ?? f}</span>
          ))}
        </div>
        <p className="truncate text-sm text-muted">
          {where}
          {lead.industry ? ` · ${lead.industry}` : ""}
          {lead.employees ? ` · ${lead.employees.toLocaleString()} employees` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lead.categories.map((c) => (
            <span key={c} className="rounded-full border border-line bg-background px-2 py-0.5 text-xs">{labels.categories[c] ?? c}</span>
          ))}
          {lead.contested && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-muted">Already contested</span>}
        </div>
        <p className="mt-2 text-sm">
          {lead.kind === "citation" ? (
            <>
              <span className="text-muted">Cited {shortDate(lead.date)}</span>
              {lead.penalty > 0 && <> · <b>{usd(lead.penalty)}</b> in penalties</>}
              {left !== null && <> · <span className={left <= 14 ? "font-semibold text-signal" : ""}>fixes due {shortDate(lead.abateBy!)}</span></>}
            </>
          ) : (
            <span className="text-muted">{lead.inspectionType} inspection opened {shortDate(lead.openDate)} · no citations yet</span>
          )}
          <span className="text-muted"> · published {daysAgoLabel(lead.published)}</span>
          {!masked && (
            <>
              {" · "}
              <a href={inspectionUrl(lead.activityNr)} target="_blank" rel="noreferrer" className="underline">OSHA record</a>
              {" · "}
              <a href={`https://www.google.com/search?q=${query}`} target="_blank" rel="noreferrer" className="underline">Find contact</a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
