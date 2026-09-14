import { getStore, getDeployStore } from "@netlify/blobs";
import { getDatabase } from "@netlify/database";

const MAX_CHUNK = 3_400_000;
function safeId(v: string | null): string { return String(v || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100); }

function documentStore(context: any) {
  return context?.deploy?.context === "production"
    ? getStore("econ-bill-documents", { consistency: "strong" })
    : getDeployStore("econ-bill-documents");
}

export default async (req: Request, context: any) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const len = Number(req.headers.get("content-length") || 0);
  if (!len || len > MAX_CHUNK) return new Response("Invalid chunk size", { status: 413 });

  const sessionId = safeId(req.headers.get("x-econ-session"));
  const documentId = safeId(req.headers.get("x-econ-document"));
  const index = Number(req.headers.get("x-econ-chunk-index"));
  const count = Number(req.headers.get("x-econ-chunk-count"));
  if (!sessionId || !documentId || !Number.isInteger(index) || !Number.isInteger(count) || index < 0 || count < 1 || index >= count || count > 16) {
    return new Response("Invalid chunk metadata", { status: 400 });
  }

  const db = getDatabase();
  const lead = await db.sql`SELECT session_id FROM leads WHERE session_id = ${sessionId} LIMIT 1`;
  if (!lead.length) return new Response("Unknown session", { status: 409 });

  const body = await req.arrayBuffer();
  if (!body.byteLength || body.byteLength > MAX_CHUNK) return new Response("Invalid chunk", { status: 413 });

  const key = `documents/${sessionId}/${documentId}/chunks/${String(index).padStart(3, "0")}`;
  await documentStore(context).set(key, body);
  return Response.json({ ok: true, index, bytes: body.byteLength });
};

export const config = {
  path: "/api/document-chunk",
  rateLimit: { windowSize: 60, windowLimit: 120, aggregateBy: ["ip"] }
};
