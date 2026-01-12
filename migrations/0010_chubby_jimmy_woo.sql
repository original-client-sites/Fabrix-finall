CREATE TABLE `payment_details` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`payment_method` varchar(50) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`payment_date` timestamp DEFAULT CURRENT_TIMESTAMP,
	`transaction_id` varchar(255),
	`status` varchar(50) NOT NULL DEFAULT 'completed',
	`notes` text,
	CONSTRAINT `payment_details_id` PRIMARY KEY(`id`)
);
