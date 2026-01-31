ALTER TABLE `discount_codes` MODIFY COLUMN `customer_name` varchar(100);--> statement-breakpoint
ALTER TABLE `discount_codes` MODIFY COLUMN `customer_email` varchar(150) NOT NULL;