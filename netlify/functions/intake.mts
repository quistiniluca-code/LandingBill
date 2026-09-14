import { getDatabase } from "@netlify/database";

function text(v: unknown, max = 240): string { return String(v ?? "").trim().slice(0, max); }
function bool(v: unknown): boolean { return v === true || String(v).toLowerCase() === "true" || String(v).toLowerCase() === "yes"; }

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const len = Number(req.headers.get("content-length") || 0);
  if (len > 32_000) return new Response("Payload too large", { status: 413 });

  let body: any;
  try { body = await req.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const sessionId = text(body.session_id, 100);
  if (!sessionId) return new Response("Missing session_id", { status: 400 });

  const db = getDatabase();
  await db.sql`
    INSERT INTO leads (
      session_id, created_at, updated_at, street, civic, municipality, province, phone,
      profile_type, privacy_consent, source, format, wave, cluster, point_id,
      utm_source, utm_medium, utm_campaign
    ) VALUES (
      ${sessionId}, NOW(), NOW(),
      ${text(body.street)}, ${text(body.civic, 40)}, ${text(body.municipality, 120)},
      ${text(body.province, 8)}, ${text(body.phone, 40)}, ${text(body.profile_type, 80)},
      ${bool(body.verification_privacy)}, ${text(body.source, 100)}, ${text(body.format, 100)},
      ${text(body.wave, 100)}, ${text(body.cluster, 100)}, ${text(body.point_id, 100)},
      ${text(body.utm_source, 140)}, ${text(body.utm_medium, 140)}, ${text(body.utm_campaign, 180)}
    )
    ON CONFLICT (session_id) DO UPDATE SET
      updated_at = NOW(), street = EXCLUDED.street, civic = EXCLUDED.civic,
      municipality = EXCLUDED.municipality, province = EXCLUDED.province,
      phone = EXCLUDED.phone, profile_type = EXCLUDED.profile_type,
      privacy_consent = EXCLUDED.privacy_consent, source = EXCLUDED.source,
      format = EXCLUDED.format, wave = EXCLUDED.wave, cluster = EXCLUDED.cluster,
      point_id = EXCLUDED.point_id, utm_source = EXCLUDED.utm_source,
      utm_medium = EXCLUDED.utm_medium, utm_campaign = EXCLUDED.utm_campaign
  `;

  if (bool(body.verification_privacy)) {
    await db.sql`
      INSERT INTO consent_log (session_id, consent_type, granted, source)
      VALUES (${sessionId}, 'verification_privacy', TRUE, 'landing')
    `;
  }

  return Response.json({ ok: true, session_id: sessionId });
};

export const config = {
  path: "/api/intake",
  rateLimit: { windowSize: 60, windowLimit: 30, aggregateBy: ["ip"] }
};
