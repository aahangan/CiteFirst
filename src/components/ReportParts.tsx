import Link from "next/link";
import { MIN_TOPIC_CASES, stateSlug, type Tally, topicSlug } from "@/lib/report";

export function TallyList({ title, items, unit }: { title: string; items: Tally[]; unit: string }) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ol className="space-y-1.5 text-sm">
        {items.map((i) => (
          <li key={i.name} className="flex justify-between gap-3"><span>{i.name}</span><span className="text-muted" title={unit}>{i.count}</span></li>
        ))}
      </ol>
    </div>
  );
}

/** Most cited standards, linking to their topic pages when there are enough cases. */
export function TopicLinks({ state, items, title = "Most cited standards" }: { state: string; items: Tally[]; title?: string }) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ol className="space-y-1.5 text-sm">
        {items.map((i) => (
          <li key={i.name} className="flex justify-between gap-3">
            {i.count >= MIN_TOPIC_CASES
              ? <Link href={`/osha-citations/${stateSlug(state)}/${topicSlug(i.name)}`} className="underline decoration-line underline-offset-2 hover:decoration-foreground">{i.name}</Link>
              : <span>{i.name}</span>}
            <span className="text-muted" title="employers">{i.count}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
