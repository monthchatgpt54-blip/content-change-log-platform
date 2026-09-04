import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { audits, contentItems } from "@/db/schema";
import { runContentAudit } from "@/lib/audit-engine";
import { requireOwnedSite, saveAudit } from "@/lib/content-repository";
import { errorResponse, requireRequestIdentity } from "@/lib/identity";

const AuditInput = z.object({
  siteId: z.string().optional(),
  title: z.string().trim().min(2).max(180),
  content: z.string().trim().min(20).max(250_000),
  contentType: z.string().trim().max(50).default("page"),
  sourceUrl: z.string().url().max(500).optional().or(z.literal("")),
  primaryKeyword: z.string().trim().max(200).optional(),
  targetMarket: z.string().trim().max(100).default("United States"),
  languageStandard: z.string().trim().max(100).default("American English"),
});

export async function GET(request: Request) {
  try {
    const { ownerId } = requireRequestIdentity(request);
    const rows = await getDb()
      .select({ audit: audits, title: contentItems.title })
      .from(audits)
      .innerJoin(contentItems, eq(contentItems.id, audits.contentItemId))
      .where(eq(audits.ownerId, ownerId))
      .orderBy(desc(audits.createdAt))
      .limit(50);
    return Response.json({ audits: rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { ownerId } = requireRequestIdentity(request);
    const input = AuditInput.parse(await request.json());
    const site = await requireOwnedSite(ownerId, input.siteId);
    const result = await runContentAudit({ ...input, niche: site.niche });
    const audit = await saveAudit({ ...input, ownerId, siteId: site.id, result });
    return Response.json({ audit, result }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message }, { status: 400 });
    return errorResponse(error);
  }
}
