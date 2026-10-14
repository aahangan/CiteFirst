import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line py-8 text-center text-sm text-muted">
      <nav className="mb-3 flex flex-wrap justify-center gap-5">
        <Link href="/demo" className="hover:text-foreground">Live demo</Link>
        <Link href="/signup" className="hover:text-foreground">Start trial</Link>
        <Link href="/login" className="hover:text-foreground">Log in</Link>
        <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
        <Link href="/terms" className="hover:text-foreground">Terms</Link>
      </nav>
      <p>© {new Date().getFullYear()} {BRAND.name}. {BRAND.disclaimer}</p>
    </footer>
  );
}
