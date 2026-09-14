import { getDatabase } from "@netlify/database";

export default async (req: Request) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  try {
    const db = getDatabase();
    const rows = await db.sql`
      SELECT
        to_regclass('public.leads') IS NOT NULL AS leads,
        to_regclass('public.verifications') IS NOT NULL AS verifications,
        to_regclass('public.documents') IS NOT NULL AS documents,
        to_regclass('public.consent_log') IS NOT NULL AS consent_log
    `;
    const r: any = rows[0] || {};
    const ready = !!(r.leads && r.verifications && r.documents && r.consent_log);
    return Response.json({ ok: true, database: true, schema_ready: ready, tables: r }, { status: ready ? 200 : 503 });
  } catch (error) {
    console.error('ECON database health check failed', error);
    return Response.json({ ok: false, database: false, schema_ready: false }, { status: 503 });
  }
};

export const config = {
  path: "/api/data-health",
  rateLimit: { windowSize: 60, windowLimit: 30, aggregateBy: ["ip"] }
};
