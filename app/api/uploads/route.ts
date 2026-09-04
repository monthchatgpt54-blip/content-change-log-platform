import { env } from "cloudflare:workers";
import { errorResponse, requireRequestIdentity } from "@/lib/identity";
import { newId } from "@/lib/ids";

const allowedTypes = new Set(["text/plain", "text/markdown", "text/html", "text/csv", "application/json"]);

export async function POST(request: Request) {
  try {
    const { ownerId } = requireRequestIdentity(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a text, Markdown, HTML, CSV, or JSON file." }, { status: 400 });
    if (file.size > 2_000_000) return Response.json({ error: "File limit is 2 MB." }, { status: 413 });
    if (!allowedTypes.has(file.type) && !/\.(txt|md|markdown|html|htm|csv|json)$/i.test(file.name)) return Response.json({ error: "This file type is not supported yet." }, { status: 415 });
    const content = await file.text();
    if (!content.trim()) return Response.json({ error: "The uploaded file is empty." }, { status: 400 });
    const ownerHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ownerId)))).slice(0, 10).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const key = `uploads/${ownerHash}/${newId("source")}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const bucket = (env as unknown as { BUCKET?: { put: (key: string, value: ArrayBuffer, options?: unknown) => Promise<unknown> } }).BUCKET;
    if (bucket) await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || "text/plain" } });
    return Response.json({ file: { name: file.name, size: file.size, storageKey: bucket ? key : null }, content });
  } catch (error) {
    return errorResponse(error);
  }
}
