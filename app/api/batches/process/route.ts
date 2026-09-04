import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { batchItems, batches, sites } from "@/db/schema";
import { runContentAudit } from "@/lib/audit-engine";
import { saveAudit } from "@/lib/content-repository";
import { errorResponse, requireRequestIdentity } from "@/lib/identity";

const ProcessInput = z.object({ batchId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const { ownerId } = requireRequestIdentity(request);
    const { batchId } = ProcessInput.parse(await request.json());
    const db = getDb();
    const [batch] = await db.select().from(batches).where(and(eq(batches.id, batchId), eq(batches.ownerId, ownerId))).limit(1);
    if (!batch) return Response.json({ error: "Batch not found" }, { status: 404 });
    const [item] = await db.select().from(batchItems).where(and(eq(batchItems.batchId, batchId), eq(batchItems.ownerId, ownerId), eq(batchItems.status, "queued"))).limit(1);
    if (!item) {
      await db.update(batches).set({ status: "needs_review", updatedAt: new Date().toISOString() }).where(eq(batches.id, batchId));
      return Response.json({ done: true, batchId });
    }
    const [site] = await db.select().from(sites).where(and(eq(sites.id, batch.siteId), eq(sites.ownerId, ownerId))).limit(1);
    if (!site) throw new Error("Website profile not found");
    await db.update(batches).set({ status: "processing", updatedAt: new Date().toISOString() }).where(eq(batches.id, batchId));
    await db.update(batchItems).set({ status: "processing", updatedAt: new Date().toISOString() }).where(eq(batchItems.id, item.id));
    try {
      const result = await runContentAudit({
        title: item.title, content: item.body, primaryKeyword: item.primaryKeyword || undefined,
        targetMarket: site.targetMarket, languageStandard: site.languageStandard, niche: site.niche,
      }, { rulesOnly: batch.totalItems > 5 });
      const audit = await saveAudit({
        ownerId, siteId: site.id, title: item.title, content: item.body, contentType: item.contentType,
        sourceUrl: item.sourceUrl || undefined, primaryKeyword: item.primaryKeyword || undefined,
        targetMarket: site.targetMarket, languageStandard: site.languageStandard, result,
        wordpressPostId: item.wordpressPostId || undefined, wordpressPostType: item.wordpressPostType || undefined,
      });
      await db.update(batchItems).set({ status: "needs_review", contentItemId: audit.contentItemId, updatedAt: new Date().toISOString() }).where(eq(batchItems.id, item.id));
      const processed = batch.processedItems + 1;
      await db.update(batches).set({ processedItems: processed, status: processed >= batch.totalItems ? "needs_review" : "processing", updatedAt: new Date().toISOString() }).where(eq(batches.id, batchId));
      return Response.json({ done: processed >= batch.totalItems, processed, total: batch.totalItems, audit });
    } catch (error) {
      await db.update(batchItems).set({ status: "failed", error: error instanceof Error ? error.message : "Unexpected error", updatedAt: new Date().toISOString() }).where(eq(batchItems.id, item.id));
      await db.update(batches).set({ failedItems: batch.failedItems + 1, processedItems: batch.processedItems + 1, updatedAt: new Date().toISOString() }).where(eq(batches.id, batchId));
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message }, { status: 400 });
    return errorResponse(error);
  }
}
