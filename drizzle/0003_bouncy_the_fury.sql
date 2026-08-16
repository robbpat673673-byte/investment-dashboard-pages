CREATE TABLE `observatory_daily_summaries` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`summaryDate` date NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`snapshotAsOf` timestamp,
	`content` text NOT NULL,
	`sourcesJson` text NOT NULL,
	`model` varchar(64) NOT NULL DEFAULT 'gpt-5-mini',
	CONSTRAINT `observatory_daily_summaries_id` PRIMARY KEY(`id`),
	CONSTRAINT `observatory_daily_summaries_date_unique` UNIQUE(`summaryDate`)
);
--> statement-breakpoint
CREATE INDEX `observatory_daily_summaries_generated_idx` ON `observatory_daily_summaries` (`generatedAt`);