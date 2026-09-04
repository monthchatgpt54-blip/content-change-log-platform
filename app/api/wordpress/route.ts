import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  activities,
  batchItems,
  batches,
  changeEntries,
  contentItems,
  revisions,
  sites,
  wordpressConnections,
} from "@/db/schema";
import { errorResponse, requireRequestIdentity } from "@/lib/identity";
import { newId } from "@/lib/ids";
import {
  containsProtectedBuilderMarkup,
  decryptSecret,
  encryptSecret,
  wordpressFetch,
} from "@/lib/wordpress";

const Input = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("connect"), siteId: z.string(), username: z.string().trim().min(1).max(120), applicationPassword: z.string().trim().min(8).max(300) }),
  z.object({ operation: z.literal("test"), siteId: z.string() }),
  z.object({ operation: z.literal("import"), siteId: z.string(), postType: z.enum(["posts", "pages", "product"]).default("posts"), limit: z.number().int().min(1).max(40).default(20) }),
  z.object({ operation: z.literal("publish"), siteId: z.string(), contentItemId: z.string(), status: z.enum(["draft", "publish"]).default("draft") }),
]);

async function ownedSite(ownerId: string, siteId: string) {
  const [site] = await getDb().select().from(sites).where(and(eq(sites.id, siteId), eq(sites.ownerId, ownerId))).limit(1);
  if (!site) throw new Error("Website profile not found");
  return site;
}

async function connectionFor(ownerId: string, siteId: string) {
  const [connection] = await getDb().select().from(wordpressConnections).where(and(eq(wordpressConnections.siteId, siteId), eq(wordpressConnections.ownerId, ownerId))).limit(1);
  if (!connection) throw new Error("WordPress is not connected for this website.");
  return connection;
}

export async function POST(request: Request) {
  try {
    const { ownerId } = requireRequestIdentity(request);
    const input = Input.parse(await request.json());
    const site = await ownedSite(ownerId, input.siteId);
    const db = getDb();

    if (input.operation === "connect") {
      await wordpressFetch(site.url, input.username, input.applicationPassword, "users/me?context=edit");
      const encrypted = await encryptSecret(input.applicationPassword);
      const existing = await db.select().from(wordpressConnections).where(eq(wordpressConnections.siteId, site.id)).limit(1);
      if (existing[0]) {
        await db.update(wordpressConnections).set({ username: input.username, encryptedApplicationPassword: encrypted, status: "connected", lastTestedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(wordpressConnections.id, existing[0].id));
      } else {
        await db.insert(wordpressConnections).values({ id: newId("wp"), ownerId, siteId: site.id, username: input.username, encryptedApplicationPassword: encrypted, status: "connected", lastTestedAt: new Date().toISOString() });
      }
      return Response.json({ connected: true, siteId: site.id });
    }

    const connection = await connectionFor(ownerId, site.id);
    const password = await decryptSecret(connection.encryptedApplicationPassword);
    if (input.operation === "test") {
      const response = await wordpressFetch(site.url, connection.username, password, "users/me?context=edit");
      const user = await response.json() as { id?: number; name?: string; roles?: string[] };
      await db.update(wordpressConnections).set({ status: "connected", lastTestedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(wordpressConnections.id, connection.id));
      return Response.json({ connected: true, user: { id: user.id, name: user.name, roles: user.roles } });
    }

    if (input.operation === "import") {
      const endpoint = `${input.postType}?context=edit&per_page=${input.limit}&status=publish,draft,pending,future,private&orderby=modified&order=desc`;
      const response = await wordpressFetch(site.url, connection.username, password, endpoint);
      const posts = await response.json() as Array<{ id: number; link?: string; slug?: string; title?: { raw?: string; rendered?: string }; content?: { raw?: string; rendered?: string } }>;
      const eligiblePosts = posts.filter((post) => (post.content?.raw || post.content?.rendered || "").trim().length >= 20);
      const batchId = newId("batch");
      await db.insert(batches).values({ id: batchId, ownerId, siteId: site.id, name: `WordPress import · ${new Date().toISOString().slice(0, 10)}`, status: "queued", publishingMode: "manual_approval", totalItems: eligiblePosts.length });
      for (const post of eligiblePosts) {
        const title = post.title?.raw || post.title?.rendered || `WordPress item ${post.id}`;
        const body = post.content?.raw || post.content?.rendered || "";
        await db.insert(batchItems).values({
          id: newId("batchitem"), ownerId, batchId, title, body, sourceUrl: post.link || null,
          contentType: input.postType === "product" ? "product" : input.postType.slice(0, -1),
          wordpressPostId: post.id, wordpressPostType: input.postType, status: "queued",
        });
      }
      return Response.json({ imported: eligiblePosts.length, batchId, message: "Imported items are queued for review. Nothing was changed in WordPress." });
    }

    const [content] = await db.select().from(contentItems).where(and(eq(contentItems.id, input.contentItemId), eq(contentItems.ownerId, ownerId), eq(contentItems.siteId, site.id))).limit(1);
    if (!content) return Response.json({ error: "Content record not found" }, { status: 404 });
    const remaining = await db.select({ id: changeEntries.id }).from(changeEntries).where(and(eq(changeEntries.contentItemId, content.id), eq(changeEntries.ownerId, ownerId), eq(changeEntries.status, "needs_review"))).limit(1);
    if (remaining.length) return Response.json({ error: "Publishing is blocked until every change is approved, rejected, or restored." }, { status: 409 });
    if (!content.currentRevisionId) return Response.json({ error: "Create an approved revision before publishing." }, { status: 409 });
    const [revision] = await db.select().from(revisions).where(and(eq(revisions.id, content.currentRevisionId), eq(revisions.ownerId, ownerId))).limit(1);
    if (!revision || revision.isProtectedOriginal) return Response.json({ error: "Apply approved changes to a new revision before publishing." }, { status: 409 });
    if (containsProtectedBuilderMarkup(revision.body)) return Response.json({ error: "Protected page-builder markup detected. Automatic whole-body publishing is blocked to prevent layout damage." }, { status: 409 });

    const postType = content.wordpressPostType || (content.contentType === "page" ? "pages" : "posts");
    const path = content.wordpressPostId ? `${postType}/${content.wordpressPostId}` : postType;
    const publishResponse = await wordpressFetch(site.url, connection.username, password, path, {
      method: "POST",
      body: JSON.stringify({ title: content.title, content: revision.body, status: input.status }),
    });
    const published = await publishResponse.json() as { id?: number; link?: string; status?: string };
    await db.update(contentItems).set({ wordpressPostId: published.id || content.wordpressPostId, status: input.status === "publish" ? "published" : "wordpress_draft", updatedAt: new Date().toISOString() }).where(eq(contentItems.id, content.id));
    await db.insert(activities).values({ id: newId("activity"), ownerId, siteId: site.id, entityType: "content", entityId: content.id, action: input.status === "publish" ? "published" : "draft_created", detail: `${content.title} sent to WordPress as ${input.status}` });
    return Response.json({ published: true, wordpress: published });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message }, { status: 400 });
    return errorResponse(error);
  }
}

export async function DELETE() {
  return Response.json({ error: "Permanent deletion is intentionally disabled." }, { status: 405, headers: { Allow: "POST" } });
}
