ALTER TABLE `batch_items` ADD `body` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `batch_items` ADD `source_url` text;--> statement-breakpoint
ALTER TABLE `batch_items` ADD `primary_keyword` text;--> statement-breakpoint
ALTER TABLE `batch_items` ADD `content_type` text DEFAULT 'page' NOT NULL;--> statement-breakpoint
ALTER TABLE `batch_items` ADD `wordpress_post_id` integer;--> statement-breakpoint
ALTER TABLE `batch_items` ADD `wordpress_post_type` text DEFAULT 'posts';