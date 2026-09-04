CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`site_id` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activities_owner_created_idx` ON `activities` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `audits` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`site_id` text NOT NULL,
	`content_item_id` text NOT NULL,
	`reference` text NOT NULL,
	`provider` text DEFAULT 'rules' NOT NULL,
	`model` text,
	`status` text DEFAULT 'needs_review' NOT NULL,
	`overall_score` integer DEFAULT 0 NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audits_reference_unique` ON `audits` (`reference`);--> statement-breakpoint
CREATE INDEX `audits_owner_status_idx` ON `audits` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `audits_content_idx` ON `audits` (`content_item_id`);--> statement-breakpoint
CREATE TABLE `batch_items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`content_item_id` text,
	`title` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `batch_items_batch_status_idx` ON `batch_items` (`batch_id`,`status`);--> statement-breakpoint
CREATE TABLE `batches` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`site_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`publishing_mode` text DEFAULT 'manual_approval' NOT NULL,
	`total_items` integer DEFAULT 0 NOT NULL,
	`processed_items` integer DEFAULT 0 NOT NULL,
	`approved_items` integer DEFAULT 0 NOT NULL,
	`failed_items` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `batches_owner_status_idx` ON `batches` (`owner_id`,`status`);--> statement-breakpoint
CREATE TABLE `change_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`audit_id` text NOT NULL,
	`content_item_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`reference` text NOT NULL,
	`exact_location` text NOT NULL,
	`category` text NOT NULL,
	`issue` text NOT NULL,
	`action` text NOT NULL,
	`priority` text NOT NULL,
	`before_text` text NOT NULL,
	`after_text` text NOT NULL,
	`reason` text NOT NULL,
	`evidence` text,
	`confidence` integer DEFAULT 80 NOT NULL,
	`status` text DEFAULT 'needs_review' NOT NULL,
	`reviewer_comment` text,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `change_reference_unique` ON `change_entries` (`reference`);--> statement-breakpoint
CREATE INDEX `changes_owner_status_idx` ON `change_entries` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `changes_audit_sequence_idx` ON `change_entries` (`audit_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `content_items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`site_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text,
	`source_url` text,
	`content_type` text DEFAULT 'page' NOT NULL,
	`wordpress_post_id` integer,
	`wordpress_post_type` text DEFAULT 'posts',
	`primary_keyword` text,
	`target_market` text DEFAULT 'United States' NOT NULL,
	`language_standard` text DEFAULT 'American English' NOT NULL,
	`status` text DEFAULT 'in_review' NOT NULL,
	`current_revision_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `content_owner_site_idx` ON `content_items` (`owner_id`,`site_id`);--> statement-breakpoint
CREATE INDEX `content_status_idx` ON `content_items` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `content_wp_post_idx` ON `content_items` (`site_id`,`wordpress_post_id`);--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`content_item_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`body` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`note` text,
	`is_protected_original` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `revisions_content_number_unique` ON `revisions` (`content_item_id`,`revision_number`);--> statement-breakpoint
CREATE INDEX `revisions_owner_content_idx` ON `revisions` (`owner_id`,`content_item_id`);--> statement-breakpoint
CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`niche` text DEFAULT 'General' NOT NULL,
	`target_market` text DEFAULT 'United States' NOT NULL,
	`language_standard` text DEFAULT 'American English' NOT NULL,
	`publishing_mode` text DEFAULT 'manual_approval' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sites_owner_url_unique` ON `sites` (`owner_id`,`url`);--> statement-breakpoint
CREATE INDEX `sites_owner_idx` ON `sites` (`owner_id`);--> statement-breakpoint
CREATE TABLE `validation_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`audit_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `validation_audit_idx` ON `validation_checks` (`audit_id`);--> statement-breakpoint
CREATE TABLE `wordpress_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`site_id` text NOT NULL,
	`username` text NOT NULL,
	`encrypted_application_password` text NOT NULL,
	`status` text DEFAULT 'connected' NOT NULL,
	`last_tested_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wp_connections_site_unique` ON `wordpress_connections` (`site_id`);--> statement-breakpoint
CREATE INDEX `wp_connections_owner_idx` ON `wordpress_connections` (`owner_id`);