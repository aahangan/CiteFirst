// Product name and domain in one place, so a rename is a one-line change.
/** Display prices. The real amounts live on the Stripe prices; keep these in sync. */
export const PLAN = { base: "$149", areaLock: "$99" };
export const TRIAL_DAYS = 14;

export const BRAND = {
  name: "CiteFirst",
  /** Split for the two-tone logo. */
  logo: ["Cite", "First"] as const,
  domain: process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "") ?? "getcitefirst.com",
  disclaimer: "Not affiliated with OSHA or the U.S. Department of Labor. Data from public OSHA enforcement records.",
};
