import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { SignupForm } from "@/components/SignupForm";
import { BRAND } from "@/lib/brand";
import { getVertical, isVerticalId } from "@/verticals";

export const metadata: Metadata = { title: `Start your free trial · ${BRAND.name}` };

export default async function Signup({ searchParams }: PageProps<"/signup">) {
  const { error, vertical: raw } = await searchParams;
  const vertical = getVertical(isVerticalId(raw) ? raw : undefined);
  return (
    <main className="mx-auto w-full max-w-md px-5 py-10">
      <Logo />
      <h1 className="mt-10 font-[family-name:var(--font-display)] text-3xl font-extrabold">Start your free trial</h1>
      <p className="mt-2 mb-8 text-muted">Tomorrow at 7am ET you&apos;ll get your first list of new {vertical.noun.plural} in your states.</p>
      <SignupForm vertical={vertical.id} initialError={error === "checkout" ? "Checkout didn't complete. Try again." : null} />
    </main>
  );
}
