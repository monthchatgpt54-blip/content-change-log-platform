import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { batchItems, batches } from "@/db/schema";
import { requireOwnedSite } from "@/lib/content-repository";
import { errorResponse, requireRequestIdentity } from "@/lib/identity";
import { newId } from "@/lib/ids";

const BatchInput = z.object({
  siteId: z.string().optional(),
  name: z.string().trim().min(2).max(150),
  publishingMode: z.enum(["manual_approval", "draft_only", "auto_publish"]).default("manual_approval"),
  items: z.array(z.object({
    title: z.string().trim().min(2).max(180),
    content: z.string().trim().min(20).max(150_000),
    sourceUrl: z.string().url().max(500).optional().or(z.literal("")),
    primaryKeyword: z.string().trim().max(200).optional(),
    contentType: z.string().trim().max(50).default("page"),
    wordpressPostId: z.number().int().positive().optional(),
    wordpressPostType: z.string().max(30).optional(),
  })).min(1).max(40),
});

export async function GET(request: Request) {
  try {
    const { ownerId } = requireRequestIdentity(request);
    const rows = await getDb().select().from(batches).where(eq(batches.ownerId, ownerId)).orderBy(desc(batches.createdAt)).limit(30);
    return Response.json({ batches: rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { ownerId } = requireRequestIdentity(request);
    const input = BatchInput.parse(await request.json());
    const site = await requireOwnedSite(ownerId, input.siteId);
    const db = getDb();
    const batchId = newId("batch");
    await db.insert(batches).values({
      id: batchId, ownerId, siteId: site.id, name: input.name, status: "queued",
      publishingMode: input.publishingMode, totalItems: input.items.length,
    });
    for (const item of input.items) {
      await db.insert(batchItems).values({
        id: newId("batchitem"), ownerId, batchId, title: item.title, body: item.content,
        sourceUrl: item.sourceUrl || null, primaryKeyword: item.primaryKeyword || null,
        contentType: item.contentType, wordpressPostId: item.wordpressPostId ?? null,
        wordpressPostType: item.wordpressPostType || "posts", status: "queued",
      });
    }
    return Response.json({ batch: { id: batchId, totalItems: input.items.length, status: "queued" } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message }, { status: 400 });
    return errorResponse(error);
  }
}
