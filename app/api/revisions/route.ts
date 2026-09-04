import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { activities, changeEntries, contentItems, revisions } from "@/db/schema";
import { errorResponse, requireRequestIdentity } from "@/lib/identity";
import { newId } from "@/lib/ids";

const RevisionInput = z.object({
  contentItemId: z.string().min(1),
  action: z.enum(["apply_approved", "restore_original"]),
});

export async function POST(request: Request) {
  try {
    const { ownerId } = requireRequestIdentity(request);
    const input = RevisionInput.parse(await request.json());
    const db = getDb();
    const [content] = await db.select().from(contentItems).where(and(eq(contentItems.id, input.contentItemId), eq(contentItems.ownerId, ownerId))).limit(1);
    if (!content) return Response.json({ error: "Content record not found" }, { status: 404 });
    const revisionRows = await db.select().from(revisions).where(and(eq(revisions.contentItemId, content.id), eq(revisions.ownerId, ownerId))).orderBy(asc(revisions.revisionNumber));
    const original = revisionRows.find((row) => row.isProtectedOriginal);
    if (!original) throw new Error("Protected original revision not found");

    let body = original.body;
    let applied = 0;
    if (input.action === "apply_approved") {
      const approved = await db.select().from(changeEntries).where(and(eq(changeEntries.contentItemId, content.id), eq(changeEntries.ownerId, ownerId), eq(changeEntries.status, "approved"))).orderBy(asc(changeEntries.sequence));
      for (const change of approved) {
        if (change.beforeText && body.includes(change.beforeText) && !change.afterText.startsWith("Add “") && !change.afterText.startsWith("Remove this")) {
          body = body.replace(change.beforeText, change.afterText);
          applied += 1;
          await db.update(changeEntries).set({ status: "applied", updatedAt: new Date().toISOString() }).where(eq(changeEntries.id, change.id));
        }
      }
      if (!applied) return Response.json({ error: "No approved exact-text changes can be applied automatically. Review ADD, REMOVE, or instruction-only entries manually." }, { status: 409 });
    }

    const revisionId = newId("revision");
    const nextNumber = Math.max(...revisionRows.map((row) => row.revisionNumber), 0) + 1;
    await db.insert(revisions).values({
      id: revisionId, ownerId, contentItemId: content.id, revisionNumber: nextNumber, body,
      source: input.action, note: input.action === "restore_original" ? "Restored from protected Version 0" : `${applied} approved changes applied`,
    });
    await db.update(contentItems).set({ currentRevisionId: revisionId, status: input.action === "restore_original" ? "restored" : "ready_to_publish", updatedAt: new Date().toISOString() }).where(eq(contentItems.id, content.id));
    await db.insert(activities).values({ id: newId("activity"), ownerId, siteId: content.siteId, entityType: "revision", entityId: revisionId, action: input.action, detail: `${content.title}: revision ${nextNumber} created` });
    return Response.json({ revision: { id: revisionId, revisionNumber: nextNumber, applied, body } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message }, { status: 400 });
    return errorResponse(error);
  }
}
