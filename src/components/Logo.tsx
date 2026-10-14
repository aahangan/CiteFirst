import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function Logo({ href = "/", dark = false }: { href?: string; dark?: boolean }) {
  return (
    <Link href={href} className={`flex items-center gap-2 font-[family-name:var(--font-display)] text-xl font-extrabold tracking-tight ${dark ? "text-white" : ""}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 1.5 22.5 20.5H1.5Z" fill="#ea580c" strokeLinejoin="round" />
        <rect x="10.9" y="8" width="2.2" height="7" rx="1.1" fill="white" />
        <circle cx="12" cy="17.6" r="1.25" fill="white" />
      </svg>
      <span>{BRAND.logo[0]}<span className="text-signal">{BRAND.logo[1]}</span></span>
    </Link>
  );
}
