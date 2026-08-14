CREATE TABLE `app_settings` (
	`settingKey` varchar(64) NOT NULL,
	`value` text,
	`schedule_cron_task_uid` varchar(65),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_settingKey` PRIMARY KEY(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `fund_nav_history` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`fundId` int NOT NULL,
	`navDate` date NOT NULL,
	`nav` decimal(18,6) NOT NULL,
	`sourcedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fund_nav_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `fund_nav_history_fund_date_unique` UNIQUE(`fundId`,`navDate`)
);
--> statement-breakpoint
CREATE TABLE `fund_performances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fundId` int NOT NULL,
	`asOfDate` date NOT NULL,
	`latestNav` decimal(18,6) NOT NULL,
	`week` decimal(10,4),
	`month` decimal(10,4),
	`quarter` decimal(10,4),
	`halfYear` decimal(10,4),
	`year` decimal(10,4),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fund_performances_id` PRIMARY KEY(`id`),
	CONSTRAINT `fund_performances_fund_unique` UNIQUE(`fundId`)
);
--> statement-breakpoint
CREATE TABLE `funds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fundType` enum('domestic','foreign') NOT NULL,
	`name` varchar(160) NOT NULL,
	`displayCode` varchar(40),
	`mcode` varchar(48) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'TWD',
	`sortOrder` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `funds_id` PRIMARY KEY(`id`),
	CONSTRAINT `funds_mcode_unique` UNIQUE(`mcode`)
);
--> statement-breakpoint
CREATE TABLE `market_quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker` varchar(24) NOT NULL,
	`name` varchar(80) NOT NULL,
	`price` decimal(18,4),
	`change` decimal(18,4),
	`percentChange` decimal(10,4),
	`quoteDate` varchar(24),
	`showAsCard` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `market_quotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `market_quotes_ticker_unique` UNIQUE(`ticker`)
);
--> statement-breakpoint
CREATE TABLE `news_items` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`url` text NOT NULL,
	`source` varchar(120) NOT NULL,
	`publishedAt` timestamp,
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `news_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `news_items_content_hash_unique` UNIQUE(`contentHash`)
);
--> statement-breakpoint
CREATE TABLE `refresh_runs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`status` enum('running','success','partial','failed') NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	`fundsUpdated` int NOT NULL DEFAULT 0,
	`newsUpdated` int NOT NULL DEFAULT 0,
	`details` text,
	CONSTRAINT `refresh_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','user') NOT NULL DEFAULT 'user';--> statement-breakpoint
CREATE INDEX `fund_nav_history_date_idx` ON `fund_nav_history` (`navDate`);--> statement-breakpoint
CREATE INDEX `funds_type_sort_idx` ON `funds` (`fundType`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `news_items_published_idx` ON `news_items` (`publishedAt`);