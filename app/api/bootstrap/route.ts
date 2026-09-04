import { and, count, desc, eq, inArray } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import {
  activities,
  audits,
  batches,
  changeEntries,
  contentItems,
  sites,
  wordpressConnections,
} from "@/db/schema";
import { ensureDefaultSite } from "@/lib/content-repository";
import { errorResponse, requireRequestIdentity } from "@/lib/identity";

export async function GET(request: Request) {
  try {
    const { ownerId } = requireRequestIdentity(request);
    await ensureDefaultSite(ownerId);
    const db = getDb();

    const [siteRows, recentAudits, recentChanges, recentBatches, activityRows] =
      await Promise.all([
        db
          .select({
            id: sites.id,
            name: sites.name,
            url: sites.url,
            niche: sites.niche,
            targetMarket: sites.targetMarket,
            languageStandard: sites.languageStandard,
            publishingMode: sites.publishingMode,
            wordpressStatus: wordpressConnections.status,
          })
          .from(sites)
          .leftJoin(
            wordpressConnections,
            and(
              eq(wordpressConnections.siteId, sites.id),
              eq(wordpressConnections.ownerId, ownerId),
            ),
          )
          .where(eq(sites.ownerId, ownerId))
          .orderBy(desc(sites.createdAt)),
        db
          .select({
            id: audits.id,
            reference: audits.reference,
            title: contentItems.title,
            siteId: audits.siteId,
            status: audits.status,
            score: audits.overallScore,
            summary: audits.summary,
            provider: audits.provider,
            createdAt: audits.createdAt,
          })
          .from(audits)
          .innerJoin(contentItems, eq(contentItems.id, audits.contentItemId))
          .where(eq(audits.ownerId, ownerId))
          .orderBy(desc(audits.createdAt))
          .limit(20),
        db
          .select({
            id: changeEntries.id,
            auditId: changeEntries.auditId,
            contentItemId: changeEntries.contentItemId,
            siteId: contentItems.siteId,
            reference: changeEntries.reference,
            exactLocation: changeEntries.exactLocation,
            category: changeEntries.category,
            issue: changeEntries.issue,
            action: changeEntries.action,
            priority: changeEntries.priority,
            beforeText: changeEntries.beforeText,
            afterText: changeEntries.afterText,
            reason: changeEntries.reason,
            evidence: changeEntries.evidence,
            confidence: changeEntries.confidence,
            status: changeEntries.status,
            reviewerComment: changeEntries.reviewerComment,
            title: contentItems.title,
            createdAt: changeEntries.createdAt,
          })
          .from(changeEntries)
          .innerJoin(contentItems, eq(contentItems.id, changeEntries.contentItemId))
          .where(eq(changeEntries.ownerId, ownerId))
          .orderBy(desc(changeEntries.createdAt), desc(changeEntries.sequence))
          .limit(200),
        db
          .select()
          .from(batches)
          .where(eq(batches.ownerId, ownerId))
          .orderBy(desc(batches.createdAt))
          .limit(20),
        db
          .select()
          .from(activities)
          .where(eq(activities.ownerId, ownerId))
          .orderBy(desc(activities.createdAt))
          .limit(12),
      ]);

    const [contentCount, reviewCount, verifiedCount] = await Promise.all([
      db.select({ value: count() }).from(contentItems).where(eq(contentItems.ownerId, ownerId)),
      db.select({ value: count() }).from(changeEntries).where(and(eq(changeEntries.ownerId, ownerId), eq(changeEntries.status, "needs_review"))),
      db.select({ value: count() }).from(changeEntries).where(and(eq(changeEntries.ownerId, ownerId), inArray(changeEntries.status, ["approved", "applied", "verified"]))),
    ]);

    return Response.json({
      sites: siteRows,
      audits: recentAudits,
      changes: recentChanges,
      batches: recentBatches,
      activities: activityRows,
      metrics: {
        content: contentCount[0]?.value ?? 0,
        needsReview: reviewCount[0]?.value ?? 0,
        verified: verifiedCount[0]?.value ?? 0,
        activeBatches: recentBatches.filter((item) => ["queued", "processing", "needs_review"].includes(item.status)).length,
      },
      capabilities: {
        openAI: Boolean((env as unknown as Record<string, string | undefined>).OPENAI_API_KEY),
        wordpress: siteRows.some((site) => site.wordpressStatus === "connected"),
        permanentDelete: false,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
