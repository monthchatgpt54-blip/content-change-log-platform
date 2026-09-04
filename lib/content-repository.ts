import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  activities,
  audits,
  changeEntries,
  contentItems,
  revisions,
  sites,
  validationChecks,
} from "@/db/schema";
import type { AuditResult } from "@/lib/audit-engine";
import { datedReference, newId } from "@/lib/ids";

export async function ensureDefaultSite(ownerId: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(sites)
    .where(eq(sites.ownerId, ownerId))
    .orderBy(asc(sites.createdAt))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(sites)
    .values({
      id: newId("site"),
      ownerId,
      name: "My First Website",
      url: "https://example.com",
      niche: "General",
      targetMarket: "United States",
      languageStandard: "American English",
    })
    .returning();
  return created;
}

export async function requireOwnedSite(ownerId: string, siteId?: string) {
  if (!siteId || siteId === "demo-site") return ensureDefaultSite(ownerId);
  const db = getDb();
  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.ownerId, ownerId)))
    .limit(1);
  if (!site) throw new Error("Website profile not found");
  return site;
}

type SaveAuditInput = {
  ownerId: string;
  siteId: string;
  title: string;
  content: string;
  contentType: string;
  sourceUrl?: string;
  primaryKeyword?: string;
  targetMarket: string;
  languageStandard: string;
  result: AuditResult;
  wordpressPostId?: number;
  wordpressPostType?: string;
};

export async function saveAudit(input: SaveAuditInput) {
  const db = getDb();
  const contentItemId = newId("content");
  const revisionId = newId("revision");
  const auditId = newId("audit");
  const auditReference = datedReference("CL");

  await db.insert(contentItems).values({
    id: contentItemId,
    ownerId: input.ownerId,
    siteId: input.siteId,
    title: input.title,
    sourceUrl: input.sourceUrl || null,
    contentType: input.contentType,
    wordpressPostId: input.wordpressPostId ?? null,
    wordpressPostType: input.wordpressPostType || "posts",
    primaryKeyword: input.primaryKeyword || null,
    targetMarket: input.targetMarket,
    languageStandard: input.languageStandard,
    status: "in_review",
    currentRevisionId: revisionId,
  });
  await db.insert(revisions).values({
    id: revisionId,
    ownerId: input.ownerId,
    contentItemId,
    revisionNumber: 0,
    body: input.content,
    source: input.wordpressPostId ? "wordpress_import" : "manual",
    note: "Protected original before editorial changes",
    isProtectedOriginal: true,
  });
  await db.insert(audits).values({
    id: auditId,
    ownerId: input.ownerId,
    siteId: input.siteId,
    contentItemId,
    reference: auditReference,
    provider: input.result.provider,
    model: input.result.model,
    status: "needs_review",
    overallScore: input.result.score,
    summary: input.result.summary,
    completedAt: new Date().toISOString(),
  });

  for (const [index, finding] of input.result.findings.entries()) {
    await db.insert(changeEntries).values({
      id: newId("change"),
      ownerId: input.ownerId,
      auditId,
      contentItemId,
      sequence: index + 1,
      reference: `${auditReference}-${String(index + 1).padStart(3, "0")}`,
      exactLocation: finding.exactLocation,
      contentKind: finding.contentKind,
      category: finding.category,
      issue: finding.issue,
      action: finding.action,
      priority: finding.priority,
      beforeText: finding.beforeText,
      afterText: finding.afterText,
      reason: finding.reason,
      evidence: finding.evidence,
      confidence: finding.confidence,
      status: "needs_review",
    });
  }

  for (const check of input.result.checks) {
    await db.insert(validationChecks).values({
      id: newId("check"),
      ownerId: input.ownerId,
      auditId,
      name: check.name,
      status: check.status,
      detail: check.detail,
    });
  }
  await db.insert(activities).values({
    id: newId("activity"),
    ownerId: input.ownerId,
    siteId: input.siteId,
    entityType: "audit",
    entityId: auditId,
    action: "audit_completed",
    detail: `${auditReference} completed for ${input.title}`,
  });

  return {
    id: auditId,
    reference: auditReference,
    contentItemId,
    findings: input.result.findings.length,
    provider: input.result.provider,
    score: input.result.score,
  };
}
