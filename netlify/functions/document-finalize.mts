import { getStore, getDeployStore } from "@netlify/blobs";
import { getDatabase } from "@netlify/database";

const MAX_FILE = 20 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
function safeId(v: unknown): string { return String(v ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100); }
function text(v: unknown, max = 240): string { return String(v ?? "").trim().slice(0, max); }
function documentStore(context: any) {
  return context?.deploy?.context === "production"
    ? getStore("econ-bill-documents", { consistency: "strong" })
    : getDeployStore("econ-bill-documents");
}

export default async (req: Request, context: any) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const len = Number(req.headers.get("content-length") || 0);
  if (len > 24_000) return new Response("Payload too large", { status: 413 });

  let body: any;
  try { body = await req.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const sessionId = safeId(body.session_id);
  const documentId = safeId(body.document_id);
  const verificationId = safeId(body.verification_id);
  const originalName = text(body.original_name, 240);
  const mimeType = text(body.mime_type, 100);
  const sizeBytes = Number(body.size_bytes);
  const sha256 = text(body.sha256, 64).toLowerCase();
  const chunkCount = Number(body.chunk_count);
  if (!sessionId || !documentId || !originalName || !ALLOWED.has(mimeType) || !Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_FILE || !/^[a-f0-9]{64}$/.test(sha256) || !Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > 16) {
    return new Response("Invalid document metadata", { status: 400 });
  }

  const store = documentStore(context);
  for (let i = 0; i < chunkCount; i++) {
    const key = `documents/${sessionId}/${documentId}/chunks/${String(i).padStart(3, "0")}`;
    const meta = await store.getMetadata(key);
    if (!meta) return new Response(`Missing chunk ${i}`, { status: 409 });
  }

  const db = getDatabase();
  const lead = await db.sql`SELECT session_id FROM leads WHERE session_id = ${sessionId} LIMIT 1`;
  if (!lead.length) return new Response("Unknown session", { status: 409 });

  const blobPrefix = `documents/${sessionId}/${documentId}`;
  const manifest = {
    document_id: documentId,
    session_id: sessionId,
    verification_id: verificationId || null,
    original_name: originalName,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    sha256,
    chunk_count: chunkCount,
    archived_at: new Date().toISOString()
  };
  await store.setJSON(`${blobPrefix}/manifest.json`, manifest);

  await db.sql`
    INSERT INTO documents (
      document_id, session_id, verification_id, original_name, mime_type,
      size_bytes, sha256, chunk_count, blob_prefix, status
    ) VALUES (
      ${documentId}, ${sessionId}, ${verificationId || null}, ${originalName}, ${mimeType},
      ${sizeBytes}, ${sha256}, ${chunkCount}, ${blobPrefix}, 'archived'
    )
    ON CONFLICT (document_id) DO UPDATE SET
      verification_id = EXCLUDED.verification_id,
      original_name = EXCLUDED.original_name,
      mime_type = EXCLUDED.mime_type,
      size_bytes = EXCLUDED.size_bytes,
      sha256 = EXCLUDED.sha256,
      chunk_count = EXCLUDED.chunk_count,
      blob_prefix = EXCLUDED.blob_prefix,
      status = 'archived'
  `;

  return Response.json({ ok: true, document_id: documentId, sha256 });
};

export const config = {
  path: "/api/document-finalize",
  rateLimit: { windowSize: 60, windowLimit: 30, aggregateBy: ["ip"] }
};
