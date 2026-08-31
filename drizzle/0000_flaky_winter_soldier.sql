CREATE TABLE `workspaces` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`payload` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_workspaces_updated_at` ON `workspaces` (`updated_at`);