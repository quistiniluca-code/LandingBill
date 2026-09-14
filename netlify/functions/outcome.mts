import { getDatabase } from "@netlify/database";

function text(v: unknown, max = 240): string { return String(v ?? "").trim().slice(0, max); }
function num(v: unknown): number | null { const n = Number(v); return Number.isFinite(n) ? n : null; }
function bool(v: unknown): boolean { return v === true || String(v).toLowerCase() === "true" || String(v).toLowerCase() === "yes"; }

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const len = Number(req.headers.get("content-length") || 0);
  if (len > 40_000) return new Response("Payload too large", { status: 413 });

  let body: any;
  try { body = await req.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const sessionId = text(body.session_id, 100);
  const verificationId = text(body.verification_id, 100);
  if (!sessionId || !verificationId) return new Response("Missing identifiers", { status: 400 });

  const db = getDatabase();
  const existingLead = await db.sql`SELECT session_id FROM leads WHERE session_id = ${sessionId} LIMIT 1`;
  if (!existingLead.length) return new Response("Unknown session", { status: 409 });

  await db.sql`
    INSERT INTO verifications (
      verification_id, session_id, completed_at, owner_status, pv_existing, bill_path,
      bill_file_uploaded, annual_kwh, annual_spend, data_quality,
      purchase_saving_low, purchase_saving_high, pv_saving_low, pv_saving_high,
      total_saving_low, total_saving_high, calculation_version, benchmark_version,
      lead_type, fv_intent, contact_preference, document_id
    ) VALUES (
      ${verificationId}, ${sessionId}, NOW(), ${text(body.owner_status, 60)}, ${text(body.pv_existing, 60)},
      ${text(body.bill_path, 40)}, ${bool(body.bill_file_uploaded)}, ${num(body.annual_kwh)}, ${num(body.annual_spend)},
      ${text(body.data_quality, 80)}, ${num(body.purchase_saving_low)}, ${num(body.purchase_saving_high)},
      ${num(body.pv_saving_low)}, ${num(body.pv_saving_high)}, ${num(body.total_saving_low)}, ${num(body.total_saving_high)},
      ${text(body.calculation_version, 120)}, ${text(body.benchmark_version, 120)}, ${text(body.lead_type, 80)},
      ${text(body.fv_intent, 80)}, ${text(body.contact_preference, 80)}, ${text(body.document_id, 100) || null}
    )
    ON CONFLICT (verification_id) DO UPDATE SET
      completed_at = NOW(), owner_status = EXCLUDED.owner_status, pv_existing = EXCLUDED.pv_existing,
      bill_path = EXCLUDED.bill_path, bill_file_uploaded = EXCLUDED.bill_file_uploaded,
      annual_kwh = EXCLUDED.annual_kwh, annual_spend = EXCLUDED.annual_spend,
      data_quality = EXCLUDED.data_quality, purchase_saving_low = EXCLUDED.purchase_saving_low,
      purchase_saving_high = EXCLUDED.purchase_saving_high, pv_saving_low = EXCLUDED.pv_saving_low,
      pv_saving_high = EXCLUDED.pv_saving_high, total_saving_low = EXCLUDED.total_saving_low,
      total_saving_high = EXCLUDED.total_saving_high, calculation_version = EXCLUDED.calculation_version,
      benchmark_version = EXCLUDED.benchmark_version, lead_type = EXCLUDED.lead_type,
      fv_intent = EXCLUDED.fv_intent, contact_preference = EXCLUDED.contact_preference,
      document_id = EXCLUDED.document_id
  `;

  if (text(body.document_id, 100)) {
    await db.sql`
      UPDATE documents SET verification_id = ${verificationId}
      WHERE document_id = ${text(body.document_id, 100)} AND session_id = ${sessionId}
    `;
  }

  return Response.json({ ok: true, verification_id: verificationId });
};

export const config = {
  path: "/api/outcome",
  rateLimit: { windowSize: 60, windowLimit: 30, aggregateBy: ["ip"] }
};
