CREATE TABLE `rss_source_health_history` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`sourceUrl` text NOT NULL,
	`source` varchar(120) NOT NULL,
	`status` enum('fresh','stale','empty','error') NOT NULL,
	`acceptedCount` int NOT NULL DEFAULT 0,
	`latencyMs` int,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rss_source_health_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `rss_health_source_date_idx` ON `rss_source_health_history` (`source`,`recordedAt`);--> statement-breakpoint
CREATE INDEX `rss_health_date_idx` ON `rss_source_health_history` (`recordedAt`);