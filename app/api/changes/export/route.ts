import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { changeEntries, contentItems } from "@/db/schema";
import { errorResponse, requireRequestIdentity } from "@/lib/identity";

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  try {
    const { ownerId } = requireRequestIdentity(request);
    const rows = await getDb().select({
      reference: changeEntries.reference, title: contentItems.title, location: changeEntries.exactLocation,
      category: changeEntries.category, issue: changeEntries.issue, action: changeEntries.action,
      priority: changeEntries.priority, before: changeEntries.beforeText, after: changeEntries.afterText,
      reason: changeEntries.reason, evidence: changeEntries.evidence, confidence: changeEntries.confidence,
      status: changeEntries.status, comment: changeEntries.reviewerComment,
    }).from(changeEntries).innerJoin(contentItems, eq(contentItems.id, changeEntries.contentItemId)).where(eq(changeEntries.ownerId, ownerId));
    const headers = ["Reference", "Content", "Exact location", "Category", "Issue", "Action", "Priority", "Before", "After", "Reason", "Evidence", "Confidence", "Status", "Reviewer comment"];
    const csv = [headers.map(csvCell).join(","), ...rows.map((row) => Object.values(row).map(csvCell).join(","))].join("\r\n");
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="master-change-log-${new Date().toISOString().slice(0, 10)}.csv"` } });
  } catch (error) {
    return errorResponse(error);
  }
}
