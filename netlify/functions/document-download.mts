import { getStore } from "@netlify/blobs";
import { getDatabase } from "@netlify/database";

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function cookieValue(req: Request, name: string): string {
  const cookies = req.headers.get("cookie") || "";
  for (const part of cookies.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}
function safeId(v: unknown): string { return String(v ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100); }
function safeFilename(v: unknown): string { return String(v ?? "bolletta").replace(/[\r\n"\\/]/g, "_").slice(0, 180) || "bolletta"; }

export default async (req: Request, context: any) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const secret = Netlify.env.get("ECON_DASHBOARD_KEY") || "";
  if (!secret) return new Response("Dashboard key missing", { status: 503 });
  const expected = await sha256(secret);
  if (cookieValue(req, "econ_dashboard") !== expected) return new Response("Unauthorized", { status: 401 });

  const documentId = safeId(context?.params?.id);
  if (!documentId) return new Response("Invalid document id", { status: 400 });

  const db = getDatabase();
  const rows = await db.sql`
    SELECT document_id, original_name, mime_type, size_bytes, chunk_count, blob_prefix, status
    FROM documents WHERE document_id = ${documentId} LIMIT 1
  `;
  if (!rows.length || rows[0].status !== "archived") return new Response("Not found", { status: 404 });
  const doc: any = rows[0];
  const store = getStore("econ-bill-documents", { consistency: "strong" });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (let i = 0; i < Number(doc.chunk_count); i++) {
          const key = `${doc.blob_prefix}/chunks/${String(i).padStart(3, "0")}`;
          const chunk = await store.get(key, { type: "arrayBuffer" });
          if (!chunk) throw new Error(`Missing archived chunk ${i}`);
          controller.enqueue(new Uint8Array(chunk));
        }
        controller.close();
      } catch (error) {
        console.error("ECON document download failed", error);
        controller.error(error);
      }
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": doc.mime_type || "application/octet-stream",
      "content-length": String(doc.size_bytes),
      "content-disposition": `attachment; filename="${safeFilename(doc.original_name)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
};

export const config = {
  path: "/dashboard/document/:id"
};
