import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getVertical } from "@/verticals";
import { db } from "./db";
import { seal, unseal } from "./seal";

/** "pilot" = free invited trial with no card and no Stripe subscription; it ends at `pilotEndsAt`. */
export type AccountStatus = "trialing" | "active" | "past_due" | "canceled" | "dev" | "pilot";

export type Account = {
  id: string;
  email: string;
  company: string;
  /** Which lead product they buy (see src/verticals). Missing on older accounts = the default. */
  vertical?: string;
  /** Service area: state codes. Empty = nationwide. */
  areas: string[];
  /** States this account holds exclusively (paid add-on). */
  lockedAreas: string[];
  status: AccountStatus;
  stripeCustomer?: string;
  stripeSubscription?: string;
  digest: boolean;
  /** Dedupe key → time it was emailed, so the digest never repeats a lead. */
  sent: Record<string, number>;
  createdAt: number;
  pilotEndsAt?: number;
  /** Last time they opened a login link or invite. */
  lastLoginAt?: number;
  /** Last time they loaded a signed-in page (updated at most hourly). */
  lastSeenAt?: number;
};

export type LeadStatus = "new" | "called" | "quoted" | "won" | "lost";
export type LeadState = { status: LeadStatus; note?: string; updatedAt: number };

const COOKIE = "cf_session";
const k = {
  account: (id: string) => `acct:${id}`,
  email: (email: string) => `email:${email.toLowerCase()}`,
  sub: (sub: string) => `sub:${sub}`,
  lock: (vertical: string, state: string) => `lock:${vertical}:${state}`,
  states: (id: string) => `states:${id}`,
  all: "accounts",
};

export const isLive = (a: Account) =>
  a.status === "pilot" ? (a.pilotEndsAt ?? 0) > Date.now() : ["trialing", "active", "past_due", "dev"].includes(a.status);

/** Trials (paid or free) can't hold exclusive states. */
export const isTrial = (a: Account) => a.status === "trialing" || a.status === "pilot";

export function isAdmin(a: Account | null) {
  const admins = (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map((e) => e.trim()).filter(Boolean);
  return !!a && admins.includes(a.email);
}

export async function getAccount(id: string) {
  return db.get<Account>(k.account(id));
}

export async function saveAccount(a: Account) {
  await db.set(k.account(a.id), a);
}

export async function findAccountByEmail(email: string) {
  const id = await db.get<string>(k.email(email));
  return id ? getAccount(id) : null;
}

export async function findAccountBySubscription(sub: string) {
  const id = await db.get<string>(k.sub(sub));
  return id ? getAccount(id) : null;
}

export async function listAccounts(): Promise<Account[]> {
  const ids = await db.smembers(k.all);
  return (await db.mget<Account>(ids.map(k.account))).filter((a): a is Account => !!a);
}

export async function createAccount(input: Pick<Account, "email" | "company" | "areas" | "status"> & Partial<Account>) {
  const account: Account = {
    id: randomUUID(),
    lockedAreas: [],
    digest: true,
    sent: {},
    createdAt: Date.now(),
    ...input,
    email: input.email.toLowerCase(),
  };
  await saveAccount(account);
  await db.set(k.email(account.email), account.id);
  if (account.stripeSubscription) await db.set(k.sub(account.stripeSubscription), account.id);
  await db.sadd(k.all, account.id);
  return account;
}

// --- Exclusive states ----------------------------------------------------------

export const accountVertical = (a: Pick<Account, "vertical">) => getVertical(a.vertical);

export async function lockOwner(account: Pick<Account, "vertical">, area: string) {
  return db.get<string>(k.lock(accountVertical(account).id, area));
}

/** States held by other accounts; their leads are hidden from everyone else. */
export async function areasLockedByOthers(account: Account, areas: string[]) {
  const owners = await db.mget<string>(areas.map((z) => k.lock(accountVertical(account).id, z)));
  return new Set(areas.filter((_, i) => owners[i] && owners[i] !== account.id));
}

export async function claimArea(account: Account, area: string) {
  return db.claim(k.lock(accountVertical(account).id, area), account.id);
}

export async function releaseArea(account: Account, area: string) {
  if ((await lockOwner(account, area)) === account.id) await db.del(k.lock(accountVertical(account).id, area));
}

export async function releaseAllAreas(account: Account) {
  await Promise.all(account.lockedAreas.map((z) => releaseArea(account, z)));
  account.lockedAreas = [];
}

// --- Lead pipeline state ------------------------------------------------------

export async function getLeadStates(accountId: string) {
  return (await db.get<Record<string, LeadState>>(k.states(accountId))) ?? {};
}

export async function setLeadState(accountId: string, leadId: string, state: LeadState) {
  const states = await getLeadStates(accountId);
  states[leadId] = state;
  await db.set(k.states(accountId), states);
}

// --- Session -----------------------------------------------------------------

export async function signIn(accountId: string) {
  const jar = await cookies();
  jar.set(COOKIE, seal({ aid: accountId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
}

export async function currentAccount(): Promise<Account | null> {
  const session = unseal<{ aid: string }>((await cookies()).get(COOKIE)?.value);
  const account = session ? await getAccount(session.aid) : null;
  if (account && Date.now() - (account.lastSeenAt ?? 0) > 60 * 60 * 1000) {
    account.lastSeenAt = Date.now();
    await saveAccount(account);
  }
  return account;
}

export async function recordLogin(accountId: string) {
  const account = await getAccount(accountId);
  if (!account) return;
  account.lastLoginAt = account.lastSeenAt = Date.now();
  await saveAccount(account);
}

/** For pages: sends visitors without an account to the login page. */
export async function requireAccount(): Promise<Account> {
  const account = await currentAccount();
  if (!account) redirect("/login");
  return account;
}
