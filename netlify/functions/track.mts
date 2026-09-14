import { getStore } from "@netlify/blobs";

const ALLOWED_EVENTS = new Set([
  "page_view",
  "savings_started",
  "intake_submit_attempt",
  "intake_saved",
  "intake_save_failed",
  "bill_path_selected",
  "bill_file_uploaded",
  "bill_auto_read_success",
  "bill_auto_read_fallback",
  "energy_data_available",
  "energy_profile_completed",
  "savings_calculated",
  "savings_estimate_viewed",
  "fv_intent_selected",
  "contact_choice_viewed",
  "contact_preference_selected",
  "contact_preference_saved",
  "outcome_save_failed",
  "call_now_intent",
  "whatsapp_now_intent",
  "callback_requested",
  "whatsapp_contact_requested",
  "no_contact_selected"
]);

function safeText(value: unknown, max = 180): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max);
}

function safePayload(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source).slice(0, 20)) {
    if (!/^[a-zA-Z0-9_]+$/.test(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean") out[key] = value;
    else if (typeof value === "string") out[key] = safeText(value, 120);
  }
  return out;
}

export default async (req: Request, context: any) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const len = Number(req.headers.get("content-length") || 0);
  if (len > 24_000) return new Response("Payload too large", { status: 413 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventName = safeText(body?.event_name, 80);
  if (!ALLOWED_EVENTS.has(eventName)) return new Response("Unknown event", { status: 400 });

  const now = new Date();
  const clientTs = new Date(body?.ts || now.toISOString());
  const ts = Number.isNaN(clientTs.getTime()) ? now : clientTs;
  const day = ts.toISOString().slice(0, 10);
  const session = safeText(body?.session_id, 80) || "anonymous";
  const deployContext = safeText(context?.deploy?.context || "production", 32);

  const event = {
    event_name: eventName,
    session_id: session,
    ts: ts.toISOString(),
    received_at: now.toISOString(),
    deploy_context: deployContext,
    source: safeText(body?.source, 80),
    format: safeText(body?.format, 80),
    wave: safeText(body?.wave, 80),
    cluster: safeText(body?.cluster, 80),
    point: safeText(body?.point, 80),
    utm_source: safeText(body?.utm_source, 120),
    utm_medium: safeText(body?.utm_medium, 120),
    utm_campaign: safeText(body?.utm_campaign, 160),
    step: safeText(body?.step, 12),
    payload: safePayload(body?.payload)
  };

  try {
    const store = getStore("econ-funnel-events");
    const unique = crypto.randomUUID();
    await store.setJSON(`events/${day}/${ts.getTime()}-${session.slice(0, 24)}-${unique}.json`, event);
  } catch (error) {
    console.error("ECON analytics write failed", error);
    return new Response("Analytics unavailable", { status: 503 });
  }

  return new Response(null, { status: 204 });
};

export const config = {
  path: "/api/track"
};
