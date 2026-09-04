import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { sites } from "@/db/schema";
import { errorResponse, requireRequestIdentity } from "@/lib/identity";
import { newId } from "@/lib/ids";

const SiteInput = z.object({
  name: z.string().trim().min(2).max(100),
  url: z.string().url().max(500),
  niche: z.string().trim().min(2).max(100).default("General"),
  targetMarket: z.string().trim().min(2).max(100).default("United States"),
  languageStandard: z.string().trim().min(2).max(100).default("American English"),
  publishingMode: z.enum(["manual_approval", "draft_only", "auto_publish"]).default("manual_approval"),
});

export async function GET(request: Request) {
  try {
    const { ownerId } = requireRequestIdentity(request);
    const rows = await getDb().select().from(sites).where(eq(sites.ownerId, ownerId)).orderBy(desc(sites.createdAt));
    return Response.json({ sites: rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { ownerId } = requireRequestIdentity(request);
    const input = SiteInput.parse(await request.json());
    const url = new URL(input.url);
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    const [site] = await getDb().insert(sites).values({
      id: newId("site"),
      ownerId,
      ...input,
      url: url.toString().replace(/\/$/, ""),
    }).returning();
    return Response.json({ site }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message }, { status: 400 });
    return errorResponse(error);
  }
}
