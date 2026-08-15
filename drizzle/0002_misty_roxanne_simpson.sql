CREATE TABLE `fund_distributions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`fundId` int NOT NULL,
	`recordDate` date,
	`exDate` date NOT NULL,
	`payoutDate` date,
	`amount` decimal(18,6) NOT NULL,
	`annualizedYield` decimal(10,4),
	`currency` varchar(8) NOT NULL,
	`sourceUrl` text NOT NULL,
	`sourcedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fund_distributions_id` PRIMARY KEY(`id`),
	CONSTRAINT `fund_distributions_fund_ex_date_unique` UNIQUE(`fundId`,`exDate`)
);
--> statement-breakpoint
CREATE TABLE `market_history` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`ticker` varchar(24) NOT NULL,
	`pointDate` date NOT NULL,
	`close` decimal(18,6) NOT NULL,
	`source` varchar(80) NOT NULL,
	`sourcedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `market_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `market_history_ticker_date_unique` UNIQUE(`ticker`,`pointDate`)
);
--> statement-breakpoint
ALTER TABLE `fund_performances` ADD `ytd` decimal(10,4);--> statement-breakpoint
ALTER TABLE `funds` ADD `isin` varchar(20);--> statement-breakpoint
ALTER TABLE `funds` ADD `bankCode` varchar(48);--> statement-breakpoint
CREATE INDEX `fund_distributions_fund_date_idx` ON `fund_distributions` (`fundId`,`exDate`);--> statement-breakpoint
CREATE INDEX `market_history_ticker_date_idx` ON `market_history` (`ticker`,`pointDate`);