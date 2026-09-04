import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { activities, audits, changeEntries } from "@/db/schema";
import { recheckFinding } from "@/lib/audit-engine";
import { errorResponse, requireRequestIdentity } from "@/lib/identity";
import { newId } from "@/lib/ids";

const ActionInput = z.object({
  changeId: z.string().min(1),
  action: z.enum(["approve", "reject", "recheck", "restore", "verify"]),
  comment: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  try {
    const { ownerId } = requireRequestIdentity(request);
    const input = ActionInput.parse(await request.json());
    const db = getDb();
    const [change] = await db.select().from(changeEntries).where(and(eq(changeEntries.id, input.changeId), eq(changeEntries.ownerId, ownerId))).limit(1);
    if (!change) return Response.json({ error: "Change entry not found" }, { status: 404 });
    const status = { approve: "approved", reject: "rejected", recheck: "needs_review", restore: "restored", verify: "verified" }[input.action];
    const rechecked = input.action === "recheck" && input.comment
      ? await recheckFinding({
          exactLocation: change.exactLocation,
          contentKind: change.contentKind as "paragraph" | "heading" | "bullet" | "table_row" | "quote" | "code" | "page",
          category: change.category,
          issue: change.issue,
          action: change.action as "CLEAN" | "CORRECT" | "REWRITE" | "ADD" | "REMOVE" | "VERIFY",
          priority: change.priority as "Critical" | "High" | "Medium" | "Low",
          beforeText: change.beforeText,
          afterText: change.afterText,
          reason: change.reason,
          evidence: change.evidence || "",
          confidence: change.confidence,
        }, input.comment)
      : null;
    const [updated] = await db.update(changeEntries).set({
      status,
      reviewerComment: input.comment || null,
      afterText: rechecked?.afterText ?? change.afterText,
      reason: rechecked?.reason ?? change.reason,
      evidence: rechecked?.evidence ?? change.evidence,
      confidence: rechecked?.confidence ?? change.confidence,
      priority: rechecked?.priority ?? change.priority,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(and(eq(changeEntries.id, input.changeId), eq(changeEntries.ownerId, ownerId))).returning();

    const remaining = await db.select({ id: changeEntries.id }).from(changeEntries).where(and(eq(changeEntries.auditId, change.auditId), eq(changeEntries.ownerId, ownerId), eq(changeEntries.status, "needs_review"))).limit(1);
    if (!remaining.length) await db.update(audits).set({ status: "approved" }).where(and(eq(audits.id, change.auditId), eq(audits.ownerId, ownerId)));
    await db.insert(activities).values({
      id: newId("activity"), ownerId, entityType: "change", entityId: change.id,
      action: `change_${input.action}`, detail: `${change.reference} marked ${status}${input.comment ? `: ${input.comment}` : ""}`,
    });
    return Response.json({ change: updated, rechecked: Boolean(rechecked) });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message }, { status: 400 });
    return errorResponse(error);
  }
}
