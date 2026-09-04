import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const sites = sqliteTable(
  "sites",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    niche: text("niche").notNull().default("General"),
    targetMarket: text("target_market").notNull().default("United States"),
    languageStandard: text("language_standard")
      .notNull()
      .default("American English"),
    publishingMode: text("publishing_mode")
      .notNull()
      .default("manual_approval"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("sites_owner_url_unique").on(table.ownerId, table.url),
    index("sites_owner_idx").on(table.ownerId),
  ],
);

export const wordpressConnections = sqliteTable(
  "wordpress_connections",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    encryptedApplicationPassword: text("encrypted_application_password").notNull(),
    status: text("status").notNull().default("connected"),
    lastTestedAt: text("last_tested_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("wp_connections_site_unique").on(table.siteId),
    index("wp_connections_owner_idx").on(table.ownerId),
  ],
);

export const contentItems = sqliteTable(
  "content_items",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug"),
    sourceUrl: text("source_url"),
    contentType: text("content_type").notNull().default("page"),
    wordpressPostId: integer("wordpress_post_id"),
    wordpressPostType: text("wordpress_post_type").default("posts"),
    primaryKeyword: text("primary_keyword"),
    targetMarket: text("target_market").notNull().default("United States"),
    languageStandard: text("language_standard")
      .notNull()
      .default("American English"),
    status: text("status").notNull().default("in_review"),
    currentRevisionId: text("current_revision_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("content_owner_site_idx").on(table.ownerId, table.siteId),
    index("content_status_idx").on(table.ownerId, table.status),
    index("content_wp_post_idx").on(table.siteId, table.wordpressPostId),
  ],
);

export const revisions = sqliteTable(
  "revisions",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    contentItemId: text("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    body: text("body").notNull(),
    source: text("source").notNull().default("manual"),
    note: text("note"),
    isProtectedOriginal: integer("is_protected_original", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("revisions_content_number_unique").on(
      table.contentItemId,
      table.revisionNumber,
    ),
    index("revisions_owner_content_idx").on(table.ownerId, table.contentItemId),
  ],
);

export const audits = sqliteTable(
  "audits",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    contentItemId: text("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(),
    provider: text("provider").notNull().default("rules"),
    model: text("model"),
    status: text("status").notNull().default("needs_review"),
    overallScore: integer("overall_score").notNull().default(0),
    summary: text("summary").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("audits_reference_unique").on(table.reference),
    index("audits_owner_status_idx").on(table.ownerId, table.status),
    index("audits_content_idx").on(table.contentItemId),
  ],
);

export const changeEntries = sqliteTable(
  "change_entries",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    contentItemId: text("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    reference: text("reference").notNull(),
    exactLocation: text("exact_location").notNull(),
    category: text("category").notNull(),
    issue: text("issue").notNull(),
    action: text("action").notNull(),
    priority: text("priority").notNull(),
    beforeText: text("before_text").notNull(),
    afterText: text("after_text").notNull(),
    reason: text("reason").notNull(),
    evidence: text("evidence"),
    confidence: integer("confidence").notNull().default(80),
    status: text("status").notNull().default("needs_review"),
    reviewerComment: text("reviewer_comment"),
    reviewedAt: text("reviewed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("change_reference_unique").on(table.reference),
    index("changes_owner_status_idx").on(table.ownerId, table.status),
    index("changes_audit_sequence_idx").on(table.auditId, table.sequence),
  ],
);

export const validationChecks = sqliteTable(
  "validation_checks",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull(),
    detail: text("detail").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("validation_audit_idx").on(table.auditId)],
);

export const batches = sqliteTable(
  "batches",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("queued"),
    publishingMode: text("publishing_mode")
      .notNull()
      .default("manual_approval"),
    totalItems: integer("total_items").notNull().default(0),
    processedItems: integer("processed_items").notNull().default(0),
    approvedItems: integer("approved_items").notNull().default(0),
    failedItems: integer("failed_items").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("batches_owner_status_idx").on(table.ownerId, table.status)],
);

export const batchItems = sqliteTable(
  "batch_items",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    batchId: text("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    contentItemId: text("content_item_id").references(() => contentItems.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    sourceUrl: text("source_url"),
    primaryKeyword: text("primary_keyword"),
    contentType: text("content_type").notNull().default("page"),
    wordpressPostId: integer("wordpress_post_id"),
    wordpressPostType: text("wordpress_post_type").default("posts"),
    status: text("status").notNull().default("queued"),
    error: text("error"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("batch_items_batch_status_idx").on(table.batchId, table.status)],
);

export const activities = sqliteTable(
  "activities",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    siteId: text("site_id"),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    detail: text("detail").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("activities_owner_created_idx").on(table.ownerId, table.createdAt)],
);
