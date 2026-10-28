import { timingSafeEqual } from "crypto";

/** Vercel Cron sends `Bearer CRON_SECRET`; admins can call cron routes with ADMIN_SECRET. */
export function cronAuthorized(req: Request) {
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  return [process.env.CRON_SECRET, process.env.ADMIN_SECRET].some(
    (s) => !!s && s.length === given.length && timingSafeEqual(Buffer.from(s), Buffer.from(given)),
  );
}
